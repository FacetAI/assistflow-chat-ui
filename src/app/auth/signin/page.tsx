"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FacetAILogoSVG } from "@/components/icons/facetai";
import { toast } from "sonner";

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log("Attempting sign-in with callbackUrl:", callbackUrl);
      const result = await signIn("credentials", {
        email: email,
        password: password,
        redirect: false,
        callbackUrl: undefined,
      });

      console.log("Sign-in result:", result);

      if (result?.error) {
        console.error("Sign-in error:", result.error);
        toast.error("Invalid credentials", {
          description: "Please check your email and password.",
        });
      } else if (result?.ok) {
        toast.success("Welcome to FacetAI!", {
          description: "You have been successfully signed in.",
        });
        // For credentials provider, manually redirect after successful login
        console.log("Successful login, redirecting to:", callbackUrl);
        router.push(callbackUrl);
      }
    } catch (error) {
      console.error("Sign in error:", error);
      toast.error("Sign in failed", {
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="from-background via-background to-primary/5 flex min-h-screen items-center justify-center bg-gradient-to-br p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto">
            <FacetAILogoSVG className="text-primary h-12 w-12" />
          </div>
          <CardTitle className="text-2xl font-semibold">
            Sign in to FacetAI
          </CardTitle>
          <p className="text-muted-foreground">
            Access your intelligent chat interface
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              size="lg"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="text-muted-foreground mt-6 text-center text-sm">
            Secure authentication powered by Amazon Cognito
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={
      <div className="from-background via-background to-primary/5 flex min-h-screen items-center justify-center bg-gradient-to-br p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto">
              <FacetAILogoSVG className="text-primary h-12 w-12" />
            </div>
            <CardTitle className="text-2xl font-semibold">
              Loading...
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
