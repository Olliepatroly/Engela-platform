import type { Metadata } from "next";
import styles from "./signin.module.css";

export const metadata: Metadata = {
  title: "Sign in",
};

/**
 * Role-aware sign-in surface (Phase 1 wires the real form + Supabase Auth).
 * After authentication, middleware reads the role claim and routes the user:
 * clinical team → /console, clients → /app. Clinical accounts step up with TOTP.
 * Phase 0 renders the static shell only.
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

        {/* Phase 1: react-hook-form + Supabase email/password + magic link, TOTP for clinical. */}
        <div className={styles.placeholder} aria-hidden="true">
          Sign-in form arrives in Phase 1.
        </div>
      </div>
      <p className={styles.disclaimer}>
        Rehabilitation monitoring tool. Supports the medical team; it does not replace clinical care.
      </p>
    </main>
  );
}
