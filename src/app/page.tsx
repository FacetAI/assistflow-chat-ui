"use client";

import { Thread } from "@/components/thread";
import { StreamProvider } from "@/providers/Stream";
import { ThreadProvider } from "@/providers/Thread";
import { ArtifactProvider } from "@/components/thread/artifact";
import { Toaster } from "@/components/ui/sonner";
import React, { useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function DemoPage(): React.ReactNode {
  const { data: session, status } = useSession();

  // Auto-login in local dev mode
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_LOCAL_DEV_MODE === 'true' && status === "unauthenticated") {
      console.log('🔧 Local dev mode: auto-authenticating...');
      signIn('credentials', {
        email: 'dev@localhost',
        password: 'any-password',
        redirect: false,
      });
    }
  }, [status]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    // In local dev mode, show loading while auto-auth is happening
    if (process.env.NEXT_PUBLIC_LOCAL_DEV_MODE === 'true') {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div>🔧 Local dev mode: Auto-authenticating...</div>
        </div>
      );
    }
    
    router.push("/auth/signin");
    return null;
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
