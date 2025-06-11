import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useThreads } from "@/providers/Thread";
import { Thread } from "@langchain/langgraph-sdk";
import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";

import { getContentString } from "../utils";
import { useQueryState, parseAsBoolean } from "nuqs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { PanelRightOpen, PanelRightClose, Search, X } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

class ThreadSearchManager {
  private debounceTimer: NodeJS.Timeout | null = null;

  debounceSearch(callback: () => void, delay: number = 300): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(callback, delay);
  }

  searchThreads(threads: Thread[], query: string): Thread[] {
    if (!query.trim()) return threads;

    const lowercaseQuery = query.toLowerCase();
    return threads.filter((thread) => {
      if (thread.thread_id.toLowerCase().includes(lowercaseQuery)) {
        return true;
      }

      if (
        typeof thread.values === "object" &&
        thread.values &&
        "messages" in thread.values &&
        Array.isArray(thread.values.messages)
      ) {
        return thread.values.messages.some((message: any) => {
          const content = getContentString(message.content);
          return content.toLowerCase().includes(lowercaseQuery);
        });
      }

      return false;
    });
  }

  highlightMatch(text: string, query: string): React.ReactNode {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <span key={index} className="bg-yellow-200 dark:bg-yellow-900">
          {part}
        </span>
      ) : (
        part
      )
    );
  }
}

function ThreadList({
  threads,
  onThreadClick,
  searchQuery = "",
}: {
  threads: Thread[];
  onThreadClick?: (threadId: string) => void;
  searchQuery?: string;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");
  const searchManager = useMemo(() => new ThreadSearchManager(), []);
  const filteredThreads = useMemo(
    () => searchManager.searchThreads(threads, searchQuery),
    [threads, searchQuery, searchManager]
  );

  return (
    <div className="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {filteredThreads.length === 0 && (
        <div className="p-4 text-sm text-muted-foreground">
          {threads.length === 0 ? "No conversations found" : "No matching conversations"}
        </div>
      )}
      {filteredThreads.map((t) => {
        let itemText = t.thread_id;
        if (
          typeof t.values === "object" &&
          t.values &&
          "messages" in t.values &&
          Array.isArray(t.values.messages) &&
          t.values.messages?.length > 0
        ) {
          const firstMessage = t.values.messages[0];
          itemText = getContentString(firstMessage.content);
        }
        return (
          <div
            key={t.thread_id}
            className="w-full px-1"
          >
            <Button
              variant="ghost"
              className="w-[280px] items-start justify-start text-left font-normal"
              onClick={(e) => {
                e.preventDefault();
                onThreadClick?.(t.thread_id);
                if (t.thread_id === threadId) return;
                setThreadId(t.thread_id);
              }}
            >
              <p className="truncate text-ellipsis">
                {searchManager.highlightMatch(itemText, searchQuery)}
              </p>
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function ThreadHistoryLoading() {
  return (
    <div className="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {Array.from({ length: 30 }).map((_, i) => (
        <Skeleton
          key={`skeleton-${i}`}
          className="h-10 w-[280px]"
        />
      ))}
    </div>
  );
}

export default function ThreadHistory() {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const { data: session, status } = useSession();
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const { getThreads, threads, setThreads, threadsLoading, setThreadsLoading } =
    useThreads();

  const searchManager = useMemo(() => new ThreadSearchManager(), []);

  useEffect(() => {
    searchManager.debounceSearch(() => {
      setDebouncedQuery(searchQuery);
    });
  }, [searchQuery, searchManager]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (status === "loading") return;
    if (status === "unauthenticated") return;

    setThreadsLoading(true);
    getThreads()
      .then(setThreads)
      .catch(console.error)
      .finally(() => setThreadsLoading(false));
  }, [getThreads, setThreads, setThreadsLoading, session, status]);

  // Refresh threads when sidebar opens
  useEffect(() => {
    if (chatHistoryOpen && status === "authenticated") {
      setThreadsLoading(true);
      getThreads()
        .then(setThreads)
        .catch(console.error)
        .finally(() => setThreadsLoading(false));
    }
  }, [chatHistoryOpen, status, getThreads, setThreads, setThreadsLoading]);

  return (
    <>
      <div className="shadow-inner-right hidden h-screen w-[300px] shrink-0 flex-col items-start justify-start gap-6 border-r bg-background lg:flex">
        <div className="flex w-full items-center justify-between px-4 pt-1.5">
          <Button
            className="hover:bg-accent"
            variant="ghost"
            onClick={() => setChatHistoryOpen((p) => !p)}
          >
            {chatHistoryOpen ? (
              <PanelRightOpen className="size-5" />
            ) : (
              <PanelRightClose className="size-5" />
            )}
          </Button>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Thread History
          </h1>
        </div>
        <div className="px-4 w-full">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {threadsLoading ? (
          <ThreadHistoryLoading />
        ) : (
          <ThreadList threads={threads} searchQuery={debouncedQuery} />
        )}
      </div>
      <div className="lg:hidden">
        <Sheet
          open={!!chatHistoryOpen && !isLargeScreen}
          onOpenChange={(open) => {
            if (isLargeScreen) return;
            setChatHistoryOpen(open);
          }}
        >
          <SheetContent
            side="left"
            className="flex lg:hidden"
          >
            <SheetHeader>
              <SheetTitle>Thread History</SheetTitle>
            </SheetHeader>
            <ThreadList
              threads={threads}
              searchQuery={debouncedQuery}
              onThreadClick={() => setChatHistoryOpen((o) => !o)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
