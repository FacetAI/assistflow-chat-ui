"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, CheckCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";

interface FeedbackData {
  threadId: string;
  userId: string;
  rating: "positive" | "negative";
  timestamp: string;
}

interface FeedbackState {
  rating: "positive" | "negative" | null;
  isSubmitting: boolean;
  isSubmitted: boolean;
}

class FeedbackManager {
  private storageKey = "facetai-feedback";

  private getStoredFeedback(threadId: string): "positive" | "negative" | null {
    if (typeof window === "undefined") return null;
    
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return null;
      
      const data = JSON.parse(stored);
      return data[threadId] || null;
    } catch {
      return null;
    }
  }

  private storeFeedback(threadId: string, rating: "positive" | "negative"): void {
    if (typeof window === "undefined") return;
    
    try {
      const stored = localStorage.getItem(this.storageKey);
      const data = stored ? JSON.parse(stored) : {};
      data[threadId] = rating;
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn("Failed to store feedback locally:", error);
    }
  }

  async submitFeedback(feedbackData: FeedbackData): Promise<boolean> {
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedbackData),
      });

      if (!response.ok) {
        console.warn("Failed to submit feedback to server");
        return false;
      }

      this.storeFeedback(feedbackData.threadId, feedbackData.rating);
      return true;
    } catch (error) {
      console.warn("Failed to submit feedback:", error);
      this.storeFeedback(feedbackData.threadId, feedbackData.rating);
      return false;
    }
  }

  getInitialState(threadId: string | null): FeedbackState {
    if (!threadId) {
      return { rating: null, isSubmitting: false, isSubmitted: false };
    }

    const storedRating = this.getStoredFeedback(threadId);
    return {
      rating: storedRating,
      isSubmitting: false,
      isSubmitted: !!storedRating,
    };
  }
}

interface FeedbackSystemProps {
  className?: string;
}

export function FeedbackSystem({ className = "" }: FeedbackSystemProps) {
  const { data: session } = useSession();
  const [threadId] = useQueryState("threadId");
  const feedbackManager = useMemo(() => new FeedbackManager(), []);
  
  const [state, setState] = useState<FeedbackState>(() =>
    feedbackManager.getInitialState(threadId)
  );

  useEffect(() => {
    setState(feedbackManager.getInitialState(threadId));
  }, [threadId, feedbackManager]);

  const handleFeedback = async (rating: "positive" | "negative") => {
    if (!threadId || !session?.user) return;

    setState(prev => ({ ...prev, isSubmitting: true }));

    const userId = (session.user as any)?.id;
    const feedbackData: FeedbackData = {
      threadId,
      userId,
      rating,
      timestamp: new Date().toISOString(),
    };

    const success = await feedbackManager.submitFeedback(feedbackData);

    setState({
      rating,
      isSubmitting: false,
      isSubmitted: true,
    });

    if (success) {
      toast.success("Thank you for your feedback!");
    } else {
      toast.info("Feedback saved locally");
    }
  };

  if (!threadId || !session?.user) return null;

  if (state.isSubmitted) {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
        <CheckCircle className="h-4 w-4 text-green-500" />
        <span>Thank you for your feedback!</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-muted-foreground">How was this conversation?</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleFeedback("positive")}
        disabled={state.isSubmitting}
        className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-600"
      >
        <ThumbsUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleFeedback("negative")}
        disabled={state.isSubmitting}
        className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
      >
        <ThumbsDown className="h-4 w-4" />
      </Button>
    </div>
  );
}