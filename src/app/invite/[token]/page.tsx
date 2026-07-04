import type { Metadata } from "next";
import Link from "next/link";
import { EngelaMark } from "@/components/ui";
import { AcceptInviteForm, getInvitePreview } from "@/features/invites";
import styles from "../../signin/signin.module.css";

export const metadata: Metadata = {
  title: "Accept invitation",
};

export const dynamic = "force-dynamic";

const ROLE_WELCOME: Record<string, string> = {
  client: "your rehabilitation programme",
  consultant: "the clinical console",
  nurse: "the clinical console",
  cep: "the clinical console",
  physio: "the clinical console",
  admin: "the clinical console",
};

/**
 * Signed invite acceptance: the link carries a single-use token (only its
 * hash is stored). A valid invite shows who invited them and lets them set a
 * password; the role comes from the invitation, never from the visitor.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInvitePreview(token);

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <p className={styles.wordmark}>
          <EngelaMark className={styles.markIcon} size={1.2} />
          <span className={styles.wordmarkSerif}>Engela</span>
          <span className={styles.wordmarkSans}>HEALTH</span>
        </p>

        {invite ? (
          <>
            <h1 className={styles.heading}>Welcome, {invite.fullName.split(" ")[0]}</h1>
            <p className={styles.subhead}>
              {invite.inviterName} has invited you to {ROLE_WELCOME[invite.role] ?? "the platform"}.
              Set a password to accept.
            </p>
            <AcceptInviteForm
              token={token}
              fullName={invite.fullName}
              email={invite.email}
              isClient={invite.role === "client"}
            />
          </>
        ) : (
          <>
            <h1 className={styles.heading}>This invitation is no longer valid</h1>
            <p className={styles.subhead}>
              Invitation links are personal, single use, and expire after seven days. Ask the
              person who invited you to send a new one.
            </p>
            <p className={styles.subhead}>
              Already have an account? <Link href="/signin">Sign in</Link>
            </p>
          </>
        )}
      </div>
      <p className={styles.disclaimer}>
        Rehabilitation monitoring tool. Supports the medical team; it does not replace clinical care.
      </p>
    </main>
  );
}
