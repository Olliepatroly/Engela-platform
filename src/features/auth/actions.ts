"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homePathForRole, isRole } from "@/lib/roles";
import { signInSchema } from "./schema";

export type SignInState = {
  error: string | null;
};

/**
 * Email/password sign-in. On success the Supabase session cookies are set and
 * the user is redirected to their surface (clinical team → /console, clients
 * → /app) based on the role claim in the access token. Error copy is
 * deliberately vague: never reveal whether an email exists.
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

  const claimed = data.user.app_metadata?.role;
  const role = isRole(claimed) ? claimed : null;
  redirect(homePathForRole(role));
}

/** Ends the session and returns to the sign-in screen. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/signin");
}
