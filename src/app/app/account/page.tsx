import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NameForm, PasswordForm, getAccountInfo } from "@/features/account";
import { signOut } from "@/features/auth";
import styles from "@/features/account/account.module.css";

export const metadata: Metadata = {
  title: "Your account",
};

export const dynamic = "force-dynamic";

/** Client account: their details and sign-in. Sharing lives in The community. */
export default async function ClientAccountPage() {
  const account = await getAccountInfo();
  if (!account) redirect("/signin");

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
          Your details and your sign-in. Who follows your progress is managed in{" "}
          <Link className={styles.backLink} href="/app/community">
            The community
          </Link>
          .
        </p>
      </div>

      <p className={styles.emailRow}>
        Signed in as <span className={styles.emailValue}>{account.email}</span>.
      </p>

      <NameForm fullName={account.fullName} />
      <PasswordForm />

      <p className={styles.subhead}>
        This is a rehabilitation monitoring tool. It supports your medical team; it does not
        replace clinical care.
      </p>
    </main>
  );
}
