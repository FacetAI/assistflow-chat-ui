"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { HelpCircle, Send, CheckCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";

interface SupportState {
  isOpen: boolean;
  isSubmitting: boolean;
  isSubmitted: boolean;
  description: string;
}

function useSupportOverlay() {
  const [state, setState] = useState<SupportState>({
    isOpen: false,
    isSubmitting: false,
    isSubmitted: false,
    description: "",
  });

  const openOverlay = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: true, isSubmitted: false }));
  }, []);

  const closeOverlay = useCallback(() => {
    setState({
      isOpen: false,
      isSubmitting: false,
      isSubmitted: false,
      description: "",
    });
  }, []);

  const updateDescription = useCallback((description: string) => {
    setState(prev => ({ ...prev, description }));
  }, []);

  const submitSupport = useCallback(async (
    userId: string | undefined, 
    threadId: string | null, 
    description: string
  ) => {
    setState(prev => ({ ...prev, isSubmitting: true }));

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          threadId,
          description,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Support request failed:", {
          status: response.status,
          statusText: response.statusText,
          body: errorData
        });
        throw new Error(`Failed to submit support request: ${response.status} ${response.statusText}`);
      }

      setState(prev => ({ 
        ...prev, 
        isSubmitting: false, 
        isSubmitted: true,
        description: ""
      }));

      setTimeout(closeOverlay, 2000);
    } catch (error) {
      console.error('Support request error:', error)
      setState(prev => ({ ...prev, isSubmitting: false }));
      toast.error("Failed to submit support request. Please try again.");
    }
  }, [closeOverlay]);

  return {
    state,
    openOverlay,
    closeOverlay,
    updateDescription,
    submitSupport,
  };
}

export function SupportOverlayComponent() {
  const { data: session } = useSession();
  const [threadId] = useQueryState("threadId");
  const { state, openOverlay, closeOverlay, updateDescription, submitSupport } = useSupportOverlay();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.description.trim()) return;

    const userId = session?.user?.id;
    await submitSupport(userId, threadId, state.description);
  };

  return (
    <>
      <Button
        onClick={openOverlay}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
        size="icon"
        aria-label="Get support"
      >
        <HelpCircle className="h-6 w-6" />
      </Button>

      <Sheet open={state.isOpen} onOpenChange={(open) => !open && closeOverlay()}>
        <SheetContent className="sm:max-w-xl p-6">
          <SheetHeader>
            <SheetTitle>Get Support</SheetTitle>
          </SheetHeader>

          {state.isSubmitted ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <div className="text-center">
                <h3 className="font-medium">Support request submitted</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  We'll get back to you within 24 hours
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              <div>
                <Label htmlFor="description">Describe your issue</Label>
                <Textarea
                  id="description"
                  value={state.description}
                  onChange={(e) => updateDescription(e.target.value)}
                  placeholder="Please describe the issue you're experiencing..."
                  className="mt-2 min-h-[100px] resize-none"
                  maxLength={1000}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {state.description.length}/1000 characters
                </p>
              </div>

              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={closeOverlay}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={state.isSubmitting || !state.description.trim()}
                  className="flex-1"
                >
                  {state.isSubmitting ? (
                    <>Sending...</>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}