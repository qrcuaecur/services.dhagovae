import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase client for proxy.ts. Token refreshes produce cookies *and*
 * cache-control headers; both are buffered here so they can be applied to
 * whichever response we end up returning, including redirects. Dropping the
 * headers would let a CDN cache a response carrying someone's session cookie.
 */
export function createProxyClient(request: NextRequest) {
  const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = [];
  const pendingHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          // Keep the incoming request in sync so anything rendered during
          // this same request sees the refreshed token.
          request.cookies.set(name, value);
          pendingCookies.push({ name, value, options: options as Record<string, unknown> });
        }
        Object.assign(pendingHeaders, headers);
      },
    },
  });

  function applyAuth<T extends NextResponse>(response: T): T {
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options);
    }
    for (const [key, value] of Object.entries(pendingHeaders)) {
      response.headers.set(key, value);
    }
    return response;
  }

  return { supabase, applyAuth };
}
