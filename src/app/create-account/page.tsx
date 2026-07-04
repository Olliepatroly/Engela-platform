import type { Metadata } from "next";
import Link from "next/link";
import { CreateAccountOptions } from "@/features/auth/CreateAccountOptions";
import { requestAccount } from "@/features/invites";
import styles from "../signin/signin.module.css";

export const metadata: Metadata = {
  title: "Create an account",
};

/**
 * Two ways in, both invite-only. This page routes people to the right path;
 * submitted requests appear on the clinical team's invitations screen.
 */
export default function CreateAccountPage() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <p className={styles.wordmark}>
          <span className={styles.wordmarkSerif}>Engela</span>
          <span className={styles.wordmarkSans}>HEALTH</span>
        </p>
        <h1 className={styles.heading}>Create an account</h1>
        <p className={styles.subhead}>Tell us who you are and we will get you to the right door.</p>

        <CreateAccountOptions requestAction={requestAccount} />

        <p className={styles.subhead}>
          Already invited? <Link href="/signin">Sign in</Link>
        </p>
      </div>
      <p className={styles.disclaimer}>
        Rehabilitation monitoring tool. Supports the medical team; it does not replace clinical care.
      </p>
    </main>
  );
}
