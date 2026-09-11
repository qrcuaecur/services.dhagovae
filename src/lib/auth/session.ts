import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export type AdminSession = {
  userId: string;
  email: string;
  role: UserRole;
};

export type SessionState =
  | { state: "anonymous" }
  | { state: "forbidden" }
  | { state: "admin"; session: AdminSession };

/**
 * The authorization boundary for the whole app.
 *
 * Next's own docs warn that layouts are not a security boundary: they don't
 * re-render on client navigation and don't stop child segments from rendering
 * into the RSC payload. So this is called per page, per Server Action and per
 * admin route handler instead. React cache() memoises it for one render pass,
 * so calling it in a layout and its page costs a single round trip.
 */
export const getSessionState = cache(async (): Promise<SessionState> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { state: "anonymous" };

  // Role is read from the database, never from a client-supplied claim.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return { state: "forbidden" };
  }

  return {
    state: "admin",
    session: { userId: profile.id, email: profile.email, role: profile.role },
  };
});

export class AuthorizationError extends Error {
  constructor(readonly status: 401 | 403) {
    super(status === 401 ? "Not authenticated" : "Not authorized");
    this.name = "AuthorizationError";
  }
}

/** For Server Actions and Route Handlers - throws, caller maps to 401/403. */
export async function requireAdmin(): Promise<AdminSession> {
  const result = await getSessionState();

  if (result.state === "anonymous") throw new AuthorizationError(401);
  if (result.state === "forbidden") throw new AuthorizationError(403);

  return result.session;
}

/**
 * For page and layout components - redirects instead of throwing.
 *
 * A signed-in non-admin must NOT be sent to /admin/login: the proxy bounces
 * any authenticated user from there to the dashboard, which would redirect
 * back here forever. They get a terminal page with a sign-out instead.
 */
export async function requireAdminPage(): Promise<AdminSession> {
  const result = await getSessionState();

  if (result.state === "anonymous") redirect("/admin/login");
  if (result.state === "forbidden") redirect("/admin/no-access");

  return result.session;
}
