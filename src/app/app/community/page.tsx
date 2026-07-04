import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommunityView, getAccountInfo, getMyCareTeam } from "@/features/account";
import { ClientSearchView, getMyTeamRequests, searchDirectory } from "@/features/search";
import styles from "@/features/account/account.module.css";

export const metadata: Metadata = {
  title: "The community",
};

export const dynamic = "force-dynamic";

/**
 * The community — the client's team, framed as the people alongside them.
 * Professional and premium, not clinical. Sharing (consent) is managed here,
 * and the client can search for specialists and answer invites below.
 */
export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  const account = await getAccountInfo();
  if (!account) redirect("/signin");

  const [team, results, requests] = await Promise.all([
    getMyCareTeam(),
    searchDirectory(q),
    getMyTeamRequests(),
  ]);

  return (
    <>
      <div>
        <h1 className={styles.heading}>The community</h1>
        <p className={styles.subhead}>
          The people in your corner: specialists in cancer care, movement, nutrition and recovery,
          working as one team around you.
        </p>
      </div>

      <CommunityView team={team} />

      <ClientSearchView
        q={q}
        results={results}
        requests={requests}
        teamMemberIds={new Set(team.map((m) => m.clinician_id))}
      />
    </>
  );
}
