import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { isRole, type Role } from "@/lib/roles";

/**
 * Refreshes the Supabase session on every request and returns the response
 * (with refreshed auth cookies) plus the authenticated user and their role.
 *
 * The role is read from the access-token claim that Supabase's access-token
 * hook writes into `app_metadata.role`. Reading it here avoids an extra query
 * on every navigation. Never trust the client to assert its own role.
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  userId: string | null;
  role: Role | null;
  needsMfa: boolean;
}> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() re-validates the token with Supabase — do not use
  // getSession() for auth decisions (it trusts the local cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const claimed = user?.app_metadata?.role ?? user?.user_metadata?.role;
  const role: Role | null = isRole(claimed) ? claimed : null;

  // Two-step verification gate: an account with a verified TOTP factor whose
  // session has not presented a code yet (assurance level 1) must step up
  // before reaching its surface. Reads the local session only — no network.
  let needsMfa = false;
  if (user) {
    const hasVerifiedTotp = (user.factors ?? []).some(
      (f) => f.factor_type === "totp" && f.status === "verified",
    );
    if (hasVerifiedTotp) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      needsMfa = aal?.currentLevel !== "aal2";
    }
  }

  return { response, userId: user?.id ?? null, role, needsMfa };
}
