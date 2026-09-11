import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { Logo } from "@/components/shared/logo";
import { getSessionState } from "@/lib/auth/session";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  // The proxy already gates this, but a page that renders a login form should
  // never depend on the proxy having run.
  const session = await getSessionState();
  if (session.state === "admin") redirect("/admin/dashboard");

  const params = await searchParams;
  const rawRedirect = Array.isArray(params.redirectTo) ? params.redirectTo[0] : params.redirectTo;
  const redirectTo =
    rawRedirect && rawRedirect.startsWith("/admin/") && !rawRedirect.startsWith("//") ? rawRedirect : undefined;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo showName={false} className="mb-4" />
          <h1 className="text-xl font-semibold tracking-tight">Sign in to {APP_NAME}</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">Administrator access only.</p>
        </div>

        <div className="bg-card rounded-xl border p-6 shadow-sm">
          <LoginForm redirectTo={redirectTo} />
        </div>
      </div>
    </main>
  );
}
