import Link from "next/link";
import styles from "./page.module.css";

/**
 * App landing (app.engelahealth.co.uk root).
 * The marketing site lives on the separate engelahealth.co.uk domain; this
 * surface is just the entry point into the authenticated platform.
 */
export default function HomePage() {
  const marketingUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://engelahealth.co.uk";

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <p className={styles.wordmark}>
          <span className={styles.wordmarkSerif}>Engela</span>
          <span className={styles.wordmarkSans}>HEALTH</span>
        </p>
        <h1 className={styles.heading}>Clinical platform</h1>
        <p className={styles.subhead}>
          Secure access for the clinical team and for programme clients.
        </p>
        <Link href="/signin" className={styles.primary}>
          Sign in
        </Link>
        <a href={marketingUrl} className={styles.secondary}>
          Back to engelahealth.co.uk
        </a>
      </div>
      <p className={styles.disclaimer}>
        Rehabilitation monitoring tool. Supports the medical team; it does not replace clinical care.
      </p>
    </main>
  );
}
