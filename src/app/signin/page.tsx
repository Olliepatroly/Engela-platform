import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/features/auth";
import styles from "./signin.module.css";

export const metadata: Metadata = {
  title: "Sign in",
};

/**
 * Role-aware sign-in. After authentication the middleware reads the role claim
 * and keeps each user on their surface: clinical team → /console, clients →
 * /app. Clinical accounts step up with TOTP in Phase 2.
 */
export default function SignInPage() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <p className={styles.wordmark}>
          <span className={styles.wordmarkSerif}>Engela</span>
          <span className={styles.wordmarkSans}>HEALTH</span>
        </p>
        <h1 className={styles.heading}>Sign in</h1>
        <p className={styles.subhead}>
          Access is by invitation only. Enter the email your rehab lead invited.
        </p>

        <SignInForm />

        <p className={styles.subhead}>
          New here? <Link href="/create-account">Create an account</Link>
        </p>
      </div>
      <p className={styles.disclaimer}>
        Rehabilitation monitoring tool. Supports the medical team; it does not replace clinical care.
      </p>
    </main>
  );
}
