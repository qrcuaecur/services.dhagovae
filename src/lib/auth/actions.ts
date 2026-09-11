"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clientIpFrom, loginRateLimiter } from "@/lib/rate-limit/memory";
import { loginSchema } from "@/schemas/auth";

export type LoginState = { error: string | null };

/**
 * Only same-site admin paths are honoured, so a crafted ?redirectTo=
 * can't bounce a freshly authenticated admin to another origin.
 */
function safeRedirect(target: FormDataEntryValue | null): string {
  const fallback = "/admin/dashboard";
  if (typeof target !== "string" || target.length === 0) return fallback;
  if (!target.startsWith("/") || target.startsWith("//")) return fallback;
  if (!target.startsWith("/admin/")) return fallback;
  if (target.startsWith("/admin/login")) return fallback;
  return target;
}

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  // One generic message for bad input, wrong credentials and throttling, so
  // the form can't be used to discover which emails have accounts.
  const genericFailure = { error: "Invalid email or password." };

  if (!parsed.success) return genericFailure;

  const requestHeaders = await headers();
  const throttleKey = `${clientIpFrom(requestHeaders)}:${parsed.data.email.toLowerCase()}`;
  const limit = loginRateLimiter.check(throttleKey);

  if (!limit.allowed) {
    return { error: "Too many sign-in attempts. Try again in a few minutes." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return genericFailure;

  loginRateLimiter.reset(throttleKey);

  redirect(safeRedirect(formData.get("redirectTo")));
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
