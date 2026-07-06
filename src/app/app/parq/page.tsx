import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccountInfo } from "@/features/account";
import { ParqForm } from "@/features/screening";
import styles from "@/features/account/account.module.css";

export const metadata: Metadata = {
  title: "Readiness screening",
};

export const dynamic = "force-dynamic";

/**
 * The PAR-Q readiness screening: prompted at sign-on, always skippable, and
 * revisitable from the account page. Answers are stored on the client's
 * health profile for the team to read before the next session.
 */
export default async function ParqPage() {
  const account = await getAccountInfo();
  if (!account) redirect("/signin");

  return (
    <>
      <div>
        <h1 className={styles.heading}>Readiness screening</h1>
        <p className={styles.subhead}>
          Seven quick questions, yes or no. They help your team keep your programme safe and right
          for you, and they are kept with your clinical details.
        </p>
      </div>

      <ParqForm />
    </>
  );
}
