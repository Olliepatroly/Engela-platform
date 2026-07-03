import { Sparkline } from "@/components/ui";
import { formatSessionDate } from "./constants";
import type { PerformanceOverview, ProgramVM } from "./data";
import styles from "./programs.module.css";

function changeText(pct: number | null): string {
  if (pct == null) return "Not enough sessions yet for a trend";
  if (pct > 0) return `Up ${pct}% since the start`;
  if (pct < 0) return `Down ${Math.abs(pct)}% since the start`;
  return "Level since the start";
}

/**
 * Exercise overview: how strength, cardiovascular and mobility work is
 * trending across completed sessions, plus adherence. Simple, explainable
 * measures (weight moved, active minutes), not clinical scores.
 */
export function OverviewView({
  overview,
  program,
}: {
  overview: PerformanceOverview;
  program: ProgramVM | null;
}) {
  const next = program?.upcoming[0] ?? null;

  return (
    <>
      {program ? (
        <section className={styles.programCard}>
          <h2 className={styles.programTitle}>{program.title}</h2>
          {program.focus ? <p className={styles.programFocus}>{program.focus}</p> : null}
          <p className={styles.programMeta}>
            {program.startsOn ? `Started ${formatSessionDate(program.startsOn)}` : "Start date not set"}
            {program.createdByName ? ` · Built by ${program.createdByName}` : ""}
            {next ? ` · Next session ${formatSessionDate(next.scheduledFor)}` : ""}
          </p>
        </section>
      ) : (
        <section className={styles.programCard}>
          <h2 className={styles.programTitle}>No active block</h2>
          <p className={styles.emptyNote}>Start one from the Planning page.</p>
        </section>
      )}

      <div className={styles.trendGrid}>
        {overview.trends.map((trend) => (
          <section key={trend.category} className={styles.trendCard} aria-label={trend.label}>
            <h3 className={styles.trendLabel}>{trend.label}</h3>
            <p className={styles.trendValue}>
              {trend.latest != null ? (
                <>
                  {trend.latest}
                  <span className={styles.trendUnit}> {trend.unit}</span>
                </>
              ) : (
                "–"
              )}
            </p>
            <p className={styles.trendCaption}>{trend.caption}</p>
            {trend.values.length >= 2 ? (
              <div className={styles.trendSpark}>
                <Sparkline values={trend.values} width={180} height={36} />
              </div>
            ) : null}
            <p
              className={`${styles.trendChange} ${
                trend.changePct != null && trend.changePct > 0 ? styles.trendChangeUp : ""
              }`}
            >
              {changeText(trend.changePct)}
            </p>
          </section>
        ))}
      </div>

      <section className={styles.adherenceCard} aria-label="Adherence">
        <h3 className={styles.trendLabel}>Adherence</h3>
        <div className={styles.adherenceRow}>
          <div className={styles.adherenceStat}>
            <span className={styles.adherenceValue}>{overview.completedCount}</span>
            <span className={styles.adherenceCaption}>sessions completed</span>
          </div>
          <div className={styles.adherenceStat}>
            <span className={styles.adherenceValue}>{overview.missedCount}</span>
            <span className={styles.adherenceCaption}>missed</span>
          </div>
          <div className={styles.adherenceStat}>
            <span className={styles.adherenceValue}>
              {overview.pastCount > 0
                ? `${Math.round((overview.completedCount / overview.pastCount) * 100)}%`
                : "–"}
            </span>
            <span className={styles.adherenceCaption}>of scheduled sessions done</span>
          </div>
          <div className={styles.adherenceStat}>
            <span className={styles.adherenceValue}>{overview.upcomingCount}</span>
            <span className={styles.adherenceCaption}>coming up</span>
          </div>
        </div>
      </section>
    </>
  );
}
