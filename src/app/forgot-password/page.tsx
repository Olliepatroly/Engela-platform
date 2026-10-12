import type { Metadata } from "next";
import Link from "next/link";
import { EngelaMark } from "@/components/ui";
import { ForgotPasswordForm } from "@/features/auth";
import styles from "../signin/signin.module.css";

export const metadata: Metadata = {
  title: "Reset your password",
};

/**
 * "Forgotten your password?" from the sign-in screen. Sends a single-use reset
 * link to the account's confirmed email address.
 */
export default function ForgotPasswordPage() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <p className={styles.wordmark}>
          <EngelaMark className={styles.markIcon} size={1.2} />
          <span className={styles.wordmarkSerif}>Engela</span>
          <span className={styles.wordmarkSans}>HEALTH</span>
        </p>
        <h1 className={styles.heading}>Reset your password</h1>
        <p className={styles.subhead}>
          Enter the email you sign in with and we will send you a link to choose a new password.
        </p>

        <ForgotPasswordForm />

        <p className={styles.subhead}>
          Remembered it? <Link href="/signin">Back to sign in</Link>
        </p>
      </div>
      <p className={styles.disclaimer}>
        Rehabilitation monitoring tool. Supports the medical team; it does not replace clinical care.
      </p>
    </main>
  );
}
