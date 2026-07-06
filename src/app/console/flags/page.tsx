import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sidebar, getRoster } from "@/features/console";
import {
  FlagsView,
  RaiseFlagForm,
  getCareClients,
  getClientBackground,
  getFlags,
} from "@/features/flags";
import { createClient } from "@/lib/supabase/server";
import consoleStyles from "@/features/console/console.module.css";
import styles from "@/features/flags/flags.module.css";

export const metadata: Metadata = {
  title: "Clinical flags",
};

export const dynamic = "force-dynamic";

/**
 * Clinical flags: the team's screening queue (tiered minor/major) and the
 * SBAR prompt for raising one. RLS scopes everything to the viewer's consented
 * care team. Client-raised concerns (voice notes) land here for review.
 */
export default async function FlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; session?: string }>;
}) {
  const { client: clientParam = "", session: sessionParam = "" } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  const viewerName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Clinical team";

  const [roster, flags, clients] = await Promise.all([getRoster(), getFlags(), getCareClients()]);

  const selectedClientId = clients.some((c) => c.id === clientParam) ? clientParam : null;
  const backgroundPrefill = selectedClientId ? await getClientBackground(selectedClientId) : "";

  return (
    <div className={consoleStyles.shell}>
      <Sidebar roster={roster} viewerName={viewerName} activeNav="flags" />
      <main className={consoleStyles.main}>
        <div className={styles.page}>
          <div>
            <h1 className={styles.heading}>Clinical flags</h1>
            <p className={styles.subhead}>
              Screening concerns for your clients, tiered minor or major. Clinician flags carry a
              full SBAR; client concerns arrive as voice notes to review.
            </p>
          </div>

          <RaiseFlagForm
            clients={clients}
            selectedClientId={selectedClientId}
            backgroundPrefill={backgroundPrefill}
            sessionId={sessionParam || null}
          />

          <FlagsView flags={flags} />
        </div>
      </main>
    </div>
  );
}
