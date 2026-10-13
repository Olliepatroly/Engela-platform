import "server-only";

import { env } from "@/lib/env";

/**
 * Transactional email via Resend's REST API (plain fetch — no SDK, keeps the
 * Worker bundle small). Returns false when RESEND_API_KEY is not configured
 * or the send fails; callers must degrade gracefully (for invites, the
 * console shows the link for the inviter to share personally).
 */
export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.warn("Email not sent: RESEND_API_KEY is not configured.");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Engela Health <${env.RESEND_FROM_EMAIL}>`,
        to: [to],
        subject,
        text,
        ...(html ? { html } : {}),
      }),
    });
    if (!res.ok) {
      // Status and Resend's error type only: never the recipient or content.
      const body = (await res.json().catch(() => null)) as { name?: string } | null;
      console.error(`Email not sent: Resend responded ${res.status} (${body?.name ?? "unknown"}).`);
    }
    return res.ok;
  } catch {
    console.error("Email not sent: could not reach Resend.");
    return false;
  }
}
