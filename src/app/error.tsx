"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Users see a generic message; the real error goes to the server logs only.
 * Never surface database or Supabase internals here.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm text-balance">
        We hit an unexpected problem. Try again, and if it keeps happening contact the administrator.
      </p>
      <Button onClick={reset} className="mt-6">
        Try again
      </Button>
    </div>
  );
}
