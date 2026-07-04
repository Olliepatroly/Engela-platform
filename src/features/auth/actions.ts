"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homePathForRole, isRole } from "@/lib/roles";
import { signInSchema } from "./schema";

export type SignInState = {
  error: string | null;
  mfaRequired?: boolean;
};

/**
 * Email/password sign-in. On success the Supabase session cookies are set and
 * the user is redirected to their surface (clinical team → /console, clients
 * → /app) based on the role claim in the access token. Accounts with two-step
 * verification stop here at assurance level 1 and are asked for a code
 * instead of being redirected. Error copy is deliberately vague: never reveal
 * whether an email exists.
 */
export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { error: "That email and password were not recognised. Check them and try again." };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    return { error: null, mfaRequired: true };
  }

  const claimed = data.user.app_metadata?.role;
  const role = isRole(claimed) ? claimed : null;
  redirect(homePathForRole(role));
}

/**
 * Second sign-in step for accounts with two-step verification: verify a six
 * digit authenticator code against the enrolled TOTP factor, upgrading the
 * session to assurance level 2, then redirect to the caller's surface.
 */
export async function verifyMfaCode(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return { error: "Enter the six digit code from your authenticator app.", mfaRequired: true };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Sign in again." };

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.status === "verified");
  if (!factor) return { error: "Two-step verification is not set up on this account." };

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: factor.id,
  });
  if (challengeError || !challenge) {
    return { error: "Could not check the code. Try again.", mfaRequired: true };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) {
    return {
      error: "That code was not recognised. Check your authenticator app and try again.",
      mfaRequired: true,
    };
  }

  const claimed = user.app_metadata?.role;
  const role = isRole(claimed) ? claimed : null;
  redirect(homePathForRole(role));
}

/** Ends the session and returns to the sign-in screen. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/signin");
}
