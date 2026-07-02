import Link from "next/link";
import { signOut } from "@/features/auth";
import { ClientMetrics } from "./ClientMetrics";
import type { ClientHomeVM } from "./data";
import styles from "./client-home.module.css";

const PILLAR_LABELS: Record<string, string> = {
  exercise: "Movement",
  nutrition: "Nutrition",
  immune: "Recovery and immunity",
};

export function ClientHomeView({ home }: { home: ClientHomeVM }) {
  const score = home.review?.composite_score ?? null;
  /* SVG ring: r=52, circumference ≈ 326.7; fill proportion = score / 10. */
  const ringCircumference = 2 * Math.PI * 52;
  const ringOffset = score != null ? ringCircumference * (1 - score / 10) : ringCircumference;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className={styles.wordmark}>
          <span className={styles.wordmarkSerif}>Engela</span>
          <span className={styles.wordmarkSans}>HEALTH</span>
        </p>
        <div className={styles.headerActions}>
          <Link className={styles.accountLink} href="/app/community">
            Community
          </Link>
          <Link className={styles.accountLink} href="/app/account">
            Account
          </Link>
          <form action={signOut}>
            <button className={styles.signOut} type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

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

      <section className={styles.pillars} aria-label="Your three pillars">
        {home.pillars.map((pillar) => (
          <div key={pillar.pillar} className={styles.pillarCard}>
            <span className={styles.pillarScore}>{pillar.score.toFixed(1)}</span>
            <span className={styles.pillarLabel}>{PILLAR_LABELS[pillar.pillar]}</span>
            {pillar.baseline != null ? (
              <span className={styles.pillarBaseline}>
                up from {pillar.baseline.toFixed(1)} when you started
              </span>
            ) : null}
          </div>
        ))}
      </section>

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

      <section className={styles.numbers} aria-label="Your numbers">
        <h2 className={styles.sectionTitle}>Your numbers</h2>
        <ClientMetrics metrics={home.metrics} />
      </section>

      <p className={styles.disclaimer}>
        This is a rehabilitation monitoring tool. It supports your medical team; it does not
        replace clinical care. If you feel unwell, contact your care team as usual.
      </p>
    </main>
  );
}
