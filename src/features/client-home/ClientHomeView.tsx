import { ClientPillars } from "./ClientPillars";
import type { ClientHomeVM } from "./data";
import styles from "./client-home.module.css";

/**
 * Client app home — the calm, phone-first surface. The wordmark, Sign out and
 * section navigation live in the client-segment layout; this renders only the
 * content. All data comes from the client-safe projection: it NEVER shows a raw
 * lab value, a disease marker or a red flag.
 */
export function ClientHomeView({ home }: { home: ClientHomeVM }) {
  const score = home.review?.composite_score ?? null;
  /* SVG ring: r=52, circumference ≈ 326.7; fill proportion = score / 10. */
  const ringCircumference = 2 * Math.PI * 52;
  const ringOffset = score != null ? ringCircumference * (1 - score / 10) : ringCircumference;

  return (
    <>
      <section className={styles.hero}>
        <h1 className={styles.greeting}>Hello {home.client.first_name}</h1>
        <p className={styles.heroNote}>
          Week {home.review?.week_no ?? home.client.programme_week} of your programme. Here is your
          week at a glance.
        </p>

        <div className={styles.ringWrap}>
          <svg viewBox="0 0 120 120" className={styles.ring} aria-hidden="true">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--c-blue-tint)" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="var(--c-amber)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className={styles.ringCentre}>
            <span className={styles.ringScore}>{score != null ? score.toFixed(1) : "–"}</span>
            <span className={styles.ringCaption}>out of 10</span>
          </div>
        </div>
        <p className={styles.heroCopy}>
          You are doing well. This week is about steadying, not pushing: a calm week protects the
          progress you have already made.
        </p>
      </section>

      <ClientPillars pillars={home.pillars} metrics={home.metrics} />

      {home.actions.length > 0 ? (
        <section className={styles.focus} aria-label="This week's focus">
          <h2 className={styles.sectionTitle}>This week&rsquo;s focus</h2>
          <ul className={styles.focusList}>
            {home.actions.map((action) => (
              <li key={action.id} className={styles.focusItem}>
                {action.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className={styles.disclaimer}>
        This is a rehabilitation monitoring tool. It supports your medical team; it does not
        replace clinical care. If you feel unwell, contact your care team as usual.
      </p>
    </>
  );
}
