import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientProgramView, getClientProgram, getOwnClient } from "@/features/programs";
import styles from "@/features/account/account.module.css";

export const metadata: Metadata = {
  title: "Your programme",
};

export const dynamic = "force-dynamic";

/**
 * The client's exercise programme: the next session, what is coming up and
 * what they have already done. Session detail (and marking parts complete)
 * lives one tap deeper.
 */
export default async function ClientProgramPage() {
  const own = await getOwnClient();
  if (!own) redirect("/signin");

  const program = await getClientProgram(own.clientId);

  return (
    <main className={styles.clientMain}>
      <header className={styles.clientHeader}>
        <Link className={styles.backLink} href="/app">
          ← This week
        </Link>
        <Link className={styles.backLink} href="/app/community">
          The community
        </Link>
      </header>

      <div>
        <h1 className={styles.heading}>Your programme</h1>
        <p className={styles.subhead}>
          Movement built around you: steady, protective and yours. One session at a time.
        </p>
      </div>

      <ClientProgramView program={program} />
    </main>
  );
}
