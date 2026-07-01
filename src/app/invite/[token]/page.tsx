import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accept invitation",
};

/**
 * Signed invite acceptance (Phase 2).
 * A signed invite link sets the invitee's role and links them to the right
 * records — nobody self-registers into a clinical role. Phase 0 is a placeholder.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  await params;
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "2rem" }}>
      <p style={{ color: "var(--c-text-secondary)" }}>
        Invitation flow arrives in Phase 2.
      </p>
    </main>
  );
}
