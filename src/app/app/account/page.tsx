import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  NameForm,
  PasswordForm,
  ConsentManager,
  getAccountInfo,
  getMyCareTeam,
} from "@/features/account";
import { signOut } from "@/features/auth";
import styles from "@/features/account/account.module.css";

export const metadata: Metadata = {
  title: "Your account",
};

export const dynamic = "force-dynamic";

/**
 * Client account: their details, password, and the consent manager. Consent
 * is real: withdrawing it removes that clinician's access in the database.
 */
export default async function ClientAccountPage() {
  const account = await getAccountInfo();
  if (!account) redirect("/signin");

  const team = await getMyCareTeam();

  return (
    <main className={styles.clientMain}>
      <header className={styles.clientHeader}>
        <Link className={styles.backLink} href="/app">
          ← This week
        </Link>
        <form action={signOut}>
          <button className={styles.withdrawBtn} type="submit">
            Sign out
          </button>
        </form>
      </header>

      <div>
        <h1 className={styles.heading}>Your account</h1>
        <p className={styles.subhead}>
          Your details, your sign-in, and who on the team can see your programme data.
        </p>
      </div>

      <p className={styles.emailRow}>
        Signed in as <span className={styles.emailValue}>{account.email}</span>.
      </p>

      <ConsentManager team={team} />
      <NameForm fullName={account.fullName} />
      <PasswordForm />

      <p className={styles.subhead}>
        This is a rehabilitation monitoring tool. It supports your medical team; it does not
        replace clinical care.
      </p>
    </main>
  );
}
