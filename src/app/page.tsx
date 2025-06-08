"use client";

import { Thread } from "@/components/thread";
import { StreamProvider } from "@/providers/Stream";
import { ThreadProvider } from "@/providers/Thread";
import { ArtifactProvider } from "@/components/thread/artifact";
import { Toaster } from "@/components/ui/sonner";
import React from "react";
import { useSession } from "next-auth/react";

export default function DemoPage(): React.ReactNode {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  // Redirect to sign-in if not authenticated
  if (status === "unauthenticated" || !session) {
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/signin';
    }
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div>Redirecting to sign in...</div>
      </div>
    );
  }

  return (
    <React.Suspense fallback={<div>Loading (layout)...</div>}>
      <Toaster />
      <ThreadProvider>
        <StreamProvider>
          <ArtifactProvider>
            <Thread />
          </ArtifactProvider>
        </StreamProvider>
      </ThreadProvider>
    </React.Suspense>
  );
}
