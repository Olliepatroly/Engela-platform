import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EngelaMark } from "@/components/ui";
import { MfaChallengeForm } from "@/features/auth";
import { createClient } from "@/lib/supabase/server";
import styles from "../signin.module.css";

export const metadata: Metadata = {
  title: "Two-step verification",
};

export const dynamic = "force-dynamic";

/**
 * Step-up screen for a signed-in account with two-step verification whose
 * session has not yet presented a code (the middleware sends clinicians here
 * before /console). Unauthenticated visitors go back to sign-in.
 */
export default async function MfaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <p className={styles.wordmark}>
          <EngelaMark className={styles.markIcon} size={1.2} />
          <span className={styles.wordmarkSerif}>Engela</span>
          <span className={styles.wordmarkSans}>HEALTH</span>
        </p>
        <h1 className={styles.heading}>Two-step verification</h1>
        <p className={styles.subhead}>
          Enter the six digit code from your authenticator app to continue.
        </p>

        <MfaChallengeForm />
      </div>
      <p className={styles.disclaimer}>
        Rehabilitation monitoring tool. Supports the medical team; it does not replace clinical care.
      </p>
    </main>
  );
}
