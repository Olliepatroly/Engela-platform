import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CommunityView, getAccountInfo, getMyCareTeam } from "@/features/account";
import styles from "@/features/account/account.module.css";

export const metadata: Metadata = {
  title: "The community",
};

export const dynamic = "force-dynamic";

/**
 * The community — the client's team, framed as the people alongside them.
 * Professional and premium, not clinical. Sharing (consent) is managed here.
 */
export default async function CommunityPage() {
  const account = await getAccountInfo();
  if (!account) redirect("/signin");

  const team = await getMyCareTeam();

  return (
    <main className={styles.clientMain}>
      <header className={styles.clientHeader}>
        <Link className={styles.backLink} href="/app">
          ← This week
        </Link>
        <Link className={styles.backLink} href="/app/account">
          Your account
        </Link>
      </header>

      <div>
        <h1 className={styles.heading}>The community</h1>
        <p className={styles.subhead}>
          The people in your corner: specialists in cancer care, movement, nutrition and recovery,
          working as one team around you.
        </p>
      </div>

      <CommunityView team={team} />
    </main>
  );
}
