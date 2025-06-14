import { getApiKey } from "@/lib/api-key";
import { Thread } from "@langchain/langgraph-sdk";
import { useQueryState } from "nuqs";
import { useSession } from "next-auth/react";
import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useState,
  Dispatch,
  SetStateAction,
} from "react";
import { createClient } from "./client";

interface ThreadContextType {
  getThreads: () => Promise<Thread[]>;
  loadMoreThreads: () => Promise<void>;
  threads: Thread[];
  setThreads: Dispatch<SetStateAction<Thread[]>>;
  threadsLoading: boolean;
  setThreadsLoading: Dispatch<SetStateAction<boolean>>;
  hasMoreThreads: boolean;
}

const ThreadContext = createContext<ThreadContextType | undefined>(undefined);

export function ThreadProvider({ children }: { children: ReactNode }) {
  // Get environment variables
  const envApiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL;
  const envAssistantId: string | undefined =
    process.env.NEXT_PUBLIC_ASSISTANT_ID;

  // Use URL params with env var fallbacks
  const [apiUrl] = useQueryState("apiUrl", {
    defaultValue: envApiUrl || "",
  });
  const [assistantId] = useQueryState("assistantId", {
    defaultValue: envAssistantId || "",
  });

  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [hasMoreThreads, setHasMoreThreads] = useState(true);
  const { data: session } = useSession();

  // Extract userId to fix dependency array warning
  const userId = (session?.user as any)?.id;

  const getThreads = useCallback(async (): Promise<Thread[]> => {
    if (!apiUrl || !assistantId || !userId) return [];

    const client = createClient(apiUrl, getApiKey() ?? undefined, userId);

    try {
      const threads = await client.threads.search({
        metadata: { user_id: userId },
        limit: 5, // Small chunks to avoid payload limits
        offset: 0,
        sortBy: "updated_at",
        sortOrder: "desc",
      });

      setHasMoreThreads(threads.length === 5);
      return threads;
    } catch (error) {
      // Check if it's a payload size error and reduce further if needed
      if (error instanceof Error && (error.message.includes('413') || error.message.includes('too large'))) {
        console.warn("Payload too large, retrying with smaller limit");
        try {
          const smallerThreads = await client.threads.search({
            metadata: { user_id: userId },
            limit: 2, // Even smaller if we hit limits
            offset: 0,
            sortBy: "updated_at",
            sortOrder: "desc",
          });
          setHasMoreThreads(smallerThreads.length === 2);
          return smallerThreads;
        } catch (retryError) {
          console.error("Error fetching threads even with reduced limit:", retryError);
          return [];
        }
      }
      console.error("Error fetching threads:", error);
      return [];
    }
  }, [apiUrl, assistantId, userId]);

  const loadMoreThreads = useCallback(async (): Promise<void> => {
    if (!apiUrl || !assistantId || !userId || !hasMoreThreads) return;

    const client = createClient(apiUrl, getApiKey() ?? undefined, userId);

    try {
      const moreThreads = await client.threads.search({
        metadata: { user_id: userId },
        limit: 5, // Small chunks to stay under limits
        offset: threads.length,
        sortBy: "updated_at",
        sortOrder: "desc",
      });

      setThreads(prev => [...prev, ...moreThreads]);
      setHasMoreThreads(moreThreads.length === 5);
    } catch (error) {
      console.error("Error loading more threads:", error);
    }
  }, [apiUrl, assistantId, userId, hasMoreThreads, threads.length]);

  const value = {
    getThreads,
    loadMoreThreads,
    threads,
    setThreads,
    threadsLoading,
    setThreadsLoading,
    hasMoreThreads,
  };

  return (
    <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
  );
}

export function useThreads() {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error("useThreads must be used within a ThreadProvider");
  }
  return context;
}
