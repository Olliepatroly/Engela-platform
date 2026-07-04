import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sidebar, getRoster, getAuditTrail } from "@/features/console";
import { createClient } from "@/lib/supabase/server";
import consoleStyles from "@/features/console/console.module.css";
import styles from "@/features/console/audit.module.css";

export const metadata: Metadata = {
  title: "Audit trail",
};

export const dynamic = "force-dynamic";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * Read-only governance screen: the append-only audit trail for the clinical
 * team. Every audited event (readings, corrections, goals, flags, sign-offs,
 * consent changes, invites) appears here, newest first. Nothing on this page
 * writes anything.
 */
export default async function AuditTrailPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  const viewerName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Clinical team";

  const [roster, entries] = await Promise.all([getRoster(), getAuditTrail()]);

  return (
    <div className={consoleStyles.shell}>
      <Sidebar roster={roster} viewerName={viewerName} activeNav="audit" />
      <main className={consoleStyles.main}>
        <div className={styles.page}>
          <div>
            <h1 className={styles.heading}>Audit trail</h1>
            <p className={styles.subhead}>
              Every audited event on the platform, newest first: readings and corrections, goals,
              actions and safety flags, weekly review sign-offs, consent changes and invitations.
              Entries are append-only; nothing here can be edited or removed.
            </p>
          </div>

          <div className={styles.tableWrap}>
            {entries.length === 0 ? (
              <p className={styles.empty}>No audited events yet.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">When (UTC)</th>
                    <th scope="col">Who</th>
                    <th scope="col">What</th>
                    <th scope="col">Client</th>
                    <th scope="col">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className={styles.when}>{formatWhen(entry.at)}</td>
                      <td>{entry.actorName}</td>
                      <td className={styles.action}>{entry.action}</td>
                      <td>{entry.clientName ?? ""}</td>
                      <td className={styles.detail}>{entry.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
