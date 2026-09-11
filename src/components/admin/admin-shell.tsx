import type { ReactNode } from "react";
import { LogOutIcon } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { MobileNav } from "@/components/admin/mobile-nav";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";

export function AdminShell({ email, children }: { email: string; children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <aside className="bg-sidebar hidden shrink-0 border-r lg:flex lg:w-60 lg:flex-col">
        <div className="flex h-14 items-center px-4">
          <Logo />
        </div>

        <div className="flex-1 px-3 py-2">
          <AdminNav />
        </div>

        <div className="border-t p-3">
          <p className="text-muted-foreground truncate px-1 pb-2 text-xs" title={email}>
            {email}
          </p>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
              <LogOutIcon className="size-4" aria-hidden="true" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <header className="bg-background sticky top-0 z-20 flex h-14 items-center justify-between border-b px-4 lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="icon" aria-label="Sign out">
              <LogOutIcon className="size-4" aria-hidden="true" />
            </Button>
          </form>
          <MobileNav />
        </div>
      </header>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
