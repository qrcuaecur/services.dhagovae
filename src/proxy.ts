import { NextResponse, type NextRequest } from "next/server";
import { createProxyClient } from "@/lib/supabase/proxy";

/**
 * Next 16 renamed middleware to proxy. This is an optimistic gate only: it
 * keeps signed-out visitors out of the admin UI and keeps signed-in admins
 * off the login page, and it refreshes the auth cookie. It is deliberately
 * NOT the authorization boundary - requireAdmin() in the data access layer
 * is, and every protected page, action and route handler calls it.
 */
export async function proxy(request: NextRequest) {
  const { supabase, applyAuth } = createProxyClient(request);

  // getUser revalidates the token with the Auth server. getSession would only
  // decode the cookie, which is attacker-controlled input.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Bare /admin is not a real page. Let it fall through to a 404 rather than
  // redirecting to the login form, so the portal isn't advertised to anyone
  // who guesses the path - only /admin/login itself shows the sign-in page.
  if (pathname === "/admin" || pathname === "/admin/") {
    return applyAuth(NextResponse.next({ request }));
  }

  const isLoginRoute = pathname === "/admin/login";

  if (isLoginRoute) {
    if (user) {
      const target = request.nextUrl.clone();
      target.pathname = "/admin/dashboard";
      target.search = "";
      return applyAuth(NextResponse.redirect(target));
    }
    return applyAuth(NextResponse.next({ request }));
  }

  if (!user) {
    const target = request.nextUrl.clone();
    target.pathname = "/admin/login";
    target.search = "";
    target.searchParams.set("redirectTo", pathname);
    return applyAuth(NextResponse.redirect(target));
  }

  return applyAuth(NextResponse.next({ request }));
}

export const config = {
  matcher: ["/admin/:path*"],
};
