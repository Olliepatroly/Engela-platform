import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sidebar, getRoster } from "@/features/console";
import { NameForm, ClinicianForm, PasswordForm, getAccountInfo } from "@/features/account";
import consoleStyles from "@/features/console/console.module.css";
import styles from "@/features/account/account.module.css";

export const metadata: Metadata = {
  title: "My account",
};

export const dynamic = "force-dynamic";

/** Account editor for the clinical team. */
export default async function ConsoleAccountPage() {
  const account = await getAccountInfo();
  if (!account) redirect("/signin");

  const roster = await getRoster();

  return (
    <div className={consoleStyles.shell}>
      <Sidebar roster={roster} viewerName={account.fullName} activeNav="account" />
      <main className={consoleStyles.main}>
        <div className={styles.page}>
          <div>
            <h1 className={styles.heading}>My account</h1>
            <p className={styles.subhead}>
              Details other members of a shared care team can see, and your sign-in settings.
            </p>
          </div>
          <p className={styles.emailRow}>
            Signed in as <span className={styles.emailValue}>{account.email}</span>. Email changes
            go through your rehab lead.
          </p>
          <NameForm fullName={account.fullName} />
          <ClinicianForm discipline={account.discipline} registrationNo={account.registrationNo} />
          <PasswordForm />
        </div>
      </main>
    </div>
  );
}
