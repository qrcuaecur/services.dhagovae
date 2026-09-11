import type { Metadata } from "next";
import { ShieldCheckIcon } from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";

export const metadata: Metadata = { title: "No access" };

/**
 * Terminal page for a signed-in account without the admin role. It must not
 * redirect to /admin/login - the proxy sends authenticated users from there
 * to the dashboard, which would bounce straight back here.
 */
export default function NoAccessPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <Logo showName={false} className="mb-6 justify-center" />
        <div className="bg-muted text-muted-foreground mx-auto mb-4 flex size-11 items-center justify-center rounded-full">
          <ShieldCheckIcon className="size-5" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight">This account has no admin access</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          You&rsquo;re signed in, but this account isn&rsquo;t an administrator. Contact whoever manages this portal if
          you think that&rsquo;s wrong.
        </p>
        <form action={logoutAction} className="mt-6">
          <Button type="submit" variant="outline" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
