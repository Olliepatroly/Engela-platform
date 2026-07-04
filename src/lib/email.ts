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
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
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
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
