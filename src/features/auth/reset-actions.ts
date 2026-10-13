"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { resetEmailHtml, resetEmailText } from "./emailTemplates";
import { passwordResetRequestSchema, passwordResetSchema } from "./schema";

export type ResetRequestState = { error: string | null; sent: boolean };
export type ResetState = { error: string | null };

/** One reset email per account per window, so the form cannot be used to flood an inbox. */
const RESEND_COOLDOWN_SECONDS = 60;

async function siteOrigin(): Promise<string> {
  const origin = (await headers()).get("origin");
  return origin ?? env.NEXT_PUBLIC_SITE_URL;
}

/**
 * "Forgotten your password?": emails a single-use reset link to the account's
 * confirmed address. Supabase issues the recovery token (generateLink), and we
 * send it through our own branded email so the link lands on /reset-password
 * rather than Supabase's hosted redirect.
 *
 * Always answers with the same message whether or not the email has an
 * account, so the form cannot be used to discover who is registered. Nothing
 * is sent to an address that has not been confirmed. Audited.
 */
export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const parsed = passwordResetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address.", sent: false };
  }
  const { email } = parsed.data;
  const done: ResetRequestState = { error: null, sent: true };

  const admin = getAdminClient();
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  // Unknown email (or any issuing failure): same answer as success.
  if (linkError || !link.user || !link.properties?.hashed_token) return done;

  const user = link.user;
  if (!user.email || !user.email_confirmed_at) return done;

  const since = new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000).toISOString();
  const { data: recent } = await admin
    .from("audit_log")
    .select("id")
    .eq("action", "password_reset.requested")
    .eq("entity_id", user.id)
    .gt("at", since)
    .limit(1);
  if (recent && recent.length > 0) return done;

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const resetUrl = `${await siteOrigin()}/reset-password?token=${encodeURIComponent(
    link.properties.hashed_token,
  )}`;
  const emailParams = { fullName: profile?.full_name ?? null, resetUrl };
  const emailSent = await sendEmail({
    to: user.email,
    subject: "Reset your Engela Health password",
    text: resetEmailText(emailParams),
    html: resetEmailHtml(emailParams),
  });

  if (!emailSent && env.NEXT_PUBLIC_ENVIRONMENT === "development") {
    // Local development without Resend: surface the link in the dev server
    // output only. Never in preview or production logs.
    console.info(`[dev] Password reset link for ${user.email}: ${resetUrl}`);
  }

  await admin.from("audit_log").insert({
    actor_id: null,
    action: "password_reset.requested",
    entity: "profiles",
    entity_id: user.id,
    meta: { email_sent: emailSent },
  });

  return done;
}

/**
 * Set a new password from the emailed link. The recovery token is verified
 * only when the form is submitted (not when the page loads), so an email
 * scanner that opens the link cannot use it up. On success every existing
 * session for the account is signed out and the person signs in again with
 * the new password; accounts with two-step verification still need their
 * code, so a reset never bypasses it. Audited.
 */
export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const parsed = passwordResetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your new password." };
  }
  const { token, password } = parsed.data;
  const expired = {
    error: "This reset link has expired or has already been used. Request a new one below.",
  };

  // Verify on a session-less client: proving possession of the link must not
  // sign this browser in. The short-lived session it returns is revoked below.
  const admin = getAdminClient();
  const { data: verified, error: verifyError } = await admin.auth.verifyOtp({
    type: "recovery",
    token_hash: token,
  });
  if (verifyError || !verified.user || !verified.session) return expired;
  const userId = verified.user.id;

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password });
  if (updateError) {
    const weak = updateError.code === "weak_password";
    return {
      error: weak
        ? "That password is too easy to guess. Choose a longer or less common one, then request a new link."
        : "Could not update your password. Request a new link and try again.",
    };
  }

  // Sign out everywhere, including the session the link just created.
  await admin.auth.admin.signOut(verified.session.access_token, "global");

  await admin.from("audit_log").insert({
    actor_id: userId,
    action: "password_reset.completed",
    entity: "profiles",
    entity_id: userId,
    meta: {},
  });

  redirect("/signin?reset=1");
}
