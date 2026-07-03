import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sidebar, getRoster } from "@/features/console";
import {
  ConsoleSearchView,
  getMyTeamClientIds,
  getMyTeamRequests,
  searchDirectory,
} from "@/features/search";
import { createClient } from "@/lib/supabase/server";
import styles from "@/features/programs/programs.module.css";

export const metadata: Metadata = {
  title: "Find people",
};

export const dynamic = "force-dynamic";

/**
 * Directory search for the clinical team: find clients to invite into your
 * care, or fellow community members to invite to a client's team, and answer
 * requests waiting for you. Search returns names and disciplines only.
 */
export default async function ConsoleSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  const viewerName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Clinical team";

  const [roster, results, requests, myClientIds] = await Promise.all([
    getRoster(),
    searchDirectory(q),
    getMyTeamRequests(),
    getMyTeamClientIds(),
  ]);

  return (
    <div className={styles.shell}>
      <Sidebar roster={roster} viewerName={viewerName} activeNav="search" />
      <main className={styles.main}>
        <ConsoleSearchView
          q={q}
          results={results}
          requests={requests}
          myClientIds={myClientIds}
          rosterClients={roster.map((r) => ({ clientId: r.clientId, fullName: r.fullName }))}
          viewerId={user.id}
        />
      </main>
    </div>
  );
}
