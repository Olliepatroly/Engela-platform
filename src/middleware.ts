import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { homePathForRole, isClinical } from "@/lib/roles";

/**
 * Session refresh + role gate.
 * - Refreshes the Supabase session on every matched request.
 * - /console/* is clinical-team only; /app/* is clients only.
 * - Unauthenticated users hitting a protected route are sent to /signin.
 * - Authenticated users hitting /signin are sent to their own surface.
 *
 * RLS in the database is the real security boundary; this middleware is a
 * usability gate that keeps people on the right surface. Never rely on it alone.
 */
export async function middleware(request: NextRequest) {
  const { response, userId, role, needsMfa } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isConsole = pathname === "/console" || pathname.startsWith("/console/");
  const isClientApp = pathname === "/app" || pathname.startsWith("/app/");
  const isSignIn = pathname === "/signin";
  const isMfaStep = pathname === "/signin/mfa";

  // Unauthenticated → protected route: redirect to sign-in, preserving intent.
  if (!userId && (isConsole || isClientApp)) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (userId) {
    // Accounts with two-step verification finish stepping up before any
    // surface. Sessions still at assurance level 1 are held at the code screen.
    if (needsMfa && (isConsole || isClientApp)) {
      const url = request.nextUrl.clone();
      url.pathname = "/signin/mfa";
      url.search = "";
      return NextResponse.redirect(url);
    }
    // Fully stepped up (or no factor): the code screen has nothing to ask.
    if (isMfaStep && !needsMfa) {
      const url = request.nextUrl.clone();
      url.pathname = homePathForRole(role);
      url.search = "";
      return NextResponse.redirect(url);
    }

    // Already signed in and sitting on /signin → send to their surface.
    if (isSignIn) {
      const url = request.nextUrl.clone();
      url.pathname = homePathForRole(role);
      url.search = "";
      return NextResponse.redirect(url);
    }

    // Wrong surface for the role → bounce to the correct one.
    if (isConsole && !isClinical(role)) {
      const url = request.nextUrl.clone();
      url.pathname = homePathForRole(role);
      return NextResponse.redirect(url);
    }
    if (isClientApp && role !== "client") {
      const url = request.nextUrl.clone();
      url.pathname = homePathForRole(role);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
