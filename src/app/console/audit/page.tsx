import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sidebar, getRoster, getAuditTrail, AuditTrailView } from "@/features/console";
import { createClient } from "@/lib/supabase/server";
import consoleStyles from "@/features/console/console.module.css";

export const metadata: Metadata = {
  title: "Audit trail",
};

export const dynamic = "force-dynamic";

/**
 * Read-only governance screen: the append-only audit trail for the clinical
 * team, scoped by RLS to what the viewer may see. Filter by time, who, client
 * and free text, and export the current selection to PDF. Nothing on this page
 * writes anything except the export event itself.
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
        <AuditTrailView entries={entries} viewerName={viewerName} />
      </main>
    </div>
  );
}
