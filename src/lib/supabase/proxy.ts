import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublicConfig } from "@/lib/env";

const PUBLIC_PATHS = ["/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/auth", "/privacy", "/terms", "/setup"];
const isPublic = (p: string) => PUBLIC_PATHS.some((x) => p === x || (x !== "/" && p.startsWith(`${x}/`)));

/**
 * Refreshes the Supabase session cookie and does an optimistic redirect for
 * signed-out visitors. This is NOT the security boundary: every page and API
 * route re-checks the user on the server, and RLS protects the data.
 */
export async function updateSession(request: NextRequest) {
  const cfg = supabasePublicConfig();
  const { pathname } = request.nextUrl;

  if (!cfg) {
    // Not configured yet: send everything to the setup page.
    if (pathname === "/setup" || pathname === "/privacy" || pathname === "/terms" || pathname.startsWith("/_next")) return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "not_configured", message: "The server is missing its Supabase configuration. See the README setup steps." } },
        { status: 503 },
      );
    }
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;

  if (!signedIn && !isPublic(pathname) && !pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (signedIn && (pathname === "/sign-in" || pathname === "/sign-up")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return response;
}
