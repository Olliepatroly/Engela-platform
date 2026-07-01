import type { Metadata } from "next";
import styles from "./console.module.css";

export const metadata: Metadata = {
  title: "Clinical Console",
};

/**
 * Consultant console (clinical team only).
 * Middleware gates this route by role. Phase 1 builds the real console:
 * roster rail, patient banner, status strip, 12-week trend table, pillar
 * scores, actions/flags and the audited sign-off, rendered from seed data.
 */
export default function ConsolePage() {
  return (
    <main className={styles.main}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Clinical Console</p>
        <h1 className={styles.heading}>Weekly review</h1>
        <p className={styles.note}>
          The console is built in Phase 1 (roster, trend table, pillar scores, audited sign-off),
          rendered from the seed patient HCA-MM-0142.
        </p>
      </div>
    </main>
  );
}
