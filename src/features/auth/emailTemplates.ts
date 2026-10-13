import "server-only";

import { escapeHtml, FONT_BODY, FONT_DISPLAY, logoMarkTableHtml } from "@/lib/emailLayout";

export type ResetEmailParams = {
  fullName: string | null;
  resetUrl: string;
};

function greeting(fullName: string | null): string {
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? `Hello ${first},` : "Hello,";
}

/** Plain-text fallback, sent alongside the HTML version. */
export function resetEmailText({ fullName, resetUrl }: ResetEmailParams): string {
  return [
    greeting(fullName),
    "",
    "We received a request to reset the password for your Engela Health account.",
    "",
    `Choose a new password here: ${resetUrl}`,
    "",
    "This link is personal to you, single use, and valid for one hour.",
    "If you did not ask to reset your password, you can ignore this email. Your password stays the same.",
    "",
    "Warmly,",
    "The Engela Health team",
  ].join("\n");
}

/** Branded HTML reset email, matching the invitation email's layout. */
export function resetEmailHtml({ fullName, resetUrl }: ResetEmailParams): string {
  const hello = escapeHtml(greeting(fullName));
  const url = escapeHtml(resetUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Reset your Engela Health password</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Hanken+Grotesk:wght@400;500;700&display=swap');
</style>
</head>
<body style="margin:0; padding:0; background-color:#FDFBF7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FDFBF7;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background-color:#FFFFFF; border:1px solid #E7E1D6; border-radius:12px; overflow:hidden;">

        <tr>
          <td style="background-color:#001A38; padding:24px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:10px;">${logoMarkTableHtml()}</td>
                <td>
                  <span style="font-family:${FONT_DISPLAY}; font-size:20px; font-weight:700; color:#FDFBF7;">Engela</span>
                  <span style="font-family:${FONT_BODY}; font-size:12px; font-weight:700; letter-spacing:2px; color:#FFA630; margin-left:8px;">HEALTH</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:40px 32px 8px;">
            <h1 style="margin:0 0 16px; font-family:${FONT_DISPLAY}; font-size:26px; line-height:1.3; color:#001A38;">Reset your password</h1>
            <p style="margin:0 0 12px; font-family:${FONT_BODY}; font-size:16px; line-height:1.6; color:#2E5077;">${hello}</p>
            <p style="margin:0 0 20px; font-family:${FONT_BODY}; font-size:16px; line-height:1.6; color:#2E5077;">We received a request to reset the password for your Engela Health account. Choose a new one using the button below.</p>
          </td>
        </tr>

        <tr>
          <td style="padding:8px 32px 32px;" align="center">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="background-color:#FFA630; border-radius:999px;">
                  <a href="${url}" style="display:inline-block; padding:14px 36px; font-family:${FONT_BODY}; font-size:16px; font-weight:700; color:#001A38; text-decoration:none;">Choose a new password</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 32px 32px;">
            <p style="margin:0 0 12px; font-family:${FONT_BODY}; font-size:13px; line-height:1.6; color:#5B6B7C;">Button not working? Copy this link instead:<br />
              <a href="${url}" style="color:#2E5077; word-break:break-all;">${url}</a>
            </p>
            <p style="margin:0; font-family:${FONT_BODY}; font-size:13px; line-height:1.6; color:#5B6B7C;">This link is personal to you, single use, and valid for one hour.</p>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px; background-color:#FDFBF7;">
            <p style="margin:0 0 6px; font-family:${FONT_BODY}; font-size:13px; line-height:1.6; color:#5B6B7C;">If you did not ask to reset your password, you can safely ignore this email. Your password stays the same.</p>
            <p style="margin:0; font-family:${FONT_BODY}; font-size:13px; line-height:1.6; color:#5B6B7C;">Warmly, The Engela Health team</p>
          </td>
        </tr>

      </table>

      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%;">
        <tr>
          <td style="padding:20px 32px 0;" align="center">
            <p style="margin:0; font-family:${FONT_BODY}; font-size:12px; line-height:1.6; color:#8A94A6;">Rehabilitation monitoring tool. Supports your medical team; it does not replace clinical care.</p>
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}
