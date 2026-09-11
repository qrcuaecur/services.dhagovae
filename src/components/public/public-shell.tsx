import type { ReactNode } from "react";
import { Logo } from "@/components/shared/logo";
import { APP_FOOTER_NOTE } from "@/lib/constants";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background border-b">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-center px-4">
          <Logo />
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">{children}</div>
      </main>

      <footer className="border-t">
        <div className="mx-auto w-full max-w-2xl px-4 py-5 text-center">
          <p className="text-muted-foreground text-xs">{APP_FOOTER_NOTE}</p>
        </div>
      </footer>
    </div>
  );
}
