import Link from "next/link";
import styles from "./screening.module.css";

/**
 * The sign-on prompt for the PAR-Q: shown at the top of the client home until
 * the screening is completed. Skippable by design (the client just carries on)
 * and framed as protective, never as a barrier.
 */
export function ParqPromptBanner() {
  return (
    <section className={styles.promptBanner} aria-label="Readiness screening">
      <h2 className={styles.promptTitle}>Two minutes to keep your programme safe</h2>
      <p className={styles.promptNote}>
        Before your next session, answer seven quick yes or no questions about your health. Your
        team reads them alongside your programme; your answers are kept with your clinical details.
      </p>
      <Link className={styles.promptLink} href="/app/parq">
        Start the screening
      </Link>
    </section>
  );
}
