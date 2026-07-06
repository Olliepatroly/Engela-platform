import type { Metadata } from "next";
import { ClientHomeView, getClientHome } from "@/features/client-home";
import { ParqPromptBanner, getOwnHealthProfile } from "@/features/screening";

export const metadata: Metadata = {
  title: "This week",
};

// Supabase reads are per-request (cookie-scoped RLS) — never prerender.
export const dynamic = "force-dynamic";

/**
 * Client app home (clients only) — the calm, phone-first surface. All data
 * comes from the client-safe projection: it NEVER shows a raw lab value, a
 * disease marker or a red flag — those stay on the console.
 */
export default async function ClientAppPage() {
  const [home, profile] = await Promise.all([getClientHome(), getOwnHealthProfile()]);

  if (!home) {
    return (
      <p style={{ padding: "3rem 0", textAlign: "center" }}>
        Your programme is being set up. Check back soon, or contact your rehab lead.
      </p>
    );
  }

  return (
    <>
      {!profile.parqCompleted ? <ParqPromptBanner /> : null}
      <ClientHomeView home={home} />
    </>
  );
}
