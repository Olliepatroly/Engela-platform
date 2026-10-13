import type { Metadata } from "next";
import Link from "next/link";
import { EngelaMark } from "@/components/ui";
import { ResetPasswordForm } from "@/features/auth";
import styles from "../signin/signin.module.css";

export const metadata: Metadata = {
  title: "Choose a new password",
};

export const dynamic = "force-dynamic";

/**
 * Landing page for the emailed reset link. The token is only checked when the
 * form is submitted, so opening the link (or an email scanner opening it)
 * never uses it up.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && /^[0-9a-f]{20,128}$/i.test(token);

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <p className={styles.wordmark}>
          <EngelaMark className={styles.markIcon} size={1.2} />
          <span className={styles.wordmarkSerif}>Engela</span>
          <span className={styles.wordmarkSans}>HEALTH</span>
        </p>

        {valid ? (
          <>
            <h1 className={styles.heading}>Choose a new password</h1>
            <p className={styles.subhead}>
              Use at least 10 characters. Once it is saved, you will be signed out everywhere and
              can sign in again with the new password.
            </p>
            <ResetPasswordForm token={token} />
          </>
        ) : (
          <>
            <h1 className={styles.heading}>This reset link is not valid</h1>
            <p className={styles.subhead}>
              Reset links are single use and expire after one hour. Request a new one and use the
              latest email.
            </p>
          </>
        )}

        <p className={styles.subhead}>
          <Link href="/forgot-password">Request a new link</Link> or{" "}
          <Link href="/signin">back to sign in</Link>
        </p>
      </div>
      <p className={styles.disclaimer}>
        Rehabilitation monitoring tool. Supports the medical team; it does not replace clinical care.
      </p>
    </main>
  );
}
