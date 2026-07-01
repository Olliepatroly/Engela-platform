import type { Metadata } from "next";
import styles from "./app.module.css";

export const metadata: Metadata = {
  title: "This week",
};

/**
 * Client app (clients only) — the calm, phone-first surface.
 * Middleware gates this route by role. Phase 1 builds the "calm hero" home:
 * composite score, three pillars and this week's gentle focus. It NEVER shows a
 * raw lab value, disease marker or red flag — those stay on the console.
 */
export default function ClientAppPage() {
  return (
    <main className={styles.main}>
      <div className={styles.inner}>
        <p className={styles.greeting}>This week</p>
        <h1 className={styles.heading}>Your progress</h1>
        <p className={styles.note}>
          The client home is built in Phase 1 (composite score, three pillars, this week&rsquo;s
          gentle focus). Calm by design.
        </p>
      </div>
    </main>
  );
}
