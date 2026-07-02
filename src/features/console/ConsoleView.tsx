import Link from "next/link";
import { StatusPill, Sparkline } from "@/components/ui";
import { signOut } from "@/features/auth";
import type { ReviewVM, RosterEntry } from "./data";
import styles from "./console.module.css";

function formatDateRange(start: string, end: string): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  return `${fmt(start)} to ${fmt(end)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const CONTEXT_LABELS: Record<string, string> = {
  diagnosis: "Diagnosis",
  treatment_phase: "Treatment phase",
  mrd: "Disease marker",
  qol: "Quality of life",
  sessions_attended: "Sessions attended",
};

export function ConsoleView({
  roster,
  review,
  viewerName,
}: {
  roster: RosterEntry[];
  review: ReviewVM | null;
  viewerName: string;
}) {
  return (
    <div className={styles.shell}>
      {/* ── Roster rail ─────────────────────────────────────────────── */}
      <aside className={styles.rail}>
        <p className={styles.wordmark}>
          <span className={styles.wordmarkSerif}>Engela</span>
          <span className={styles.wordmarkSans}>HEALTH</span>
        </p>
        <p className={styles.railHeading}>This week</p>
        <nav className={styles.rosterList} aria-label="Patients">
          {roster.map((entry) => {
            const selected = entry.clientId === review?.patient.clientId;
            return (
              <Link
                key={entry.clientId}
                href={`/console?patient=${entry.clientId}`}
                className={`${styles.rosterRow} ${selected ? styles.rosterRowSelected : ""}`}
                aria-current={selected ? "page" : undefined}
              >
                <span className={styles.rosterName}>
                  {entry.reviewStatus === "flag" ? (
                    <span className={styles.flagDot} aria-label="Flagged" />
                  ) : null}
                  {entry.fullName}
                </span>
                <span className={styles.rosterMeta}>
                  {entry.mrn}
                  {entry.week != null ? ` · Week ${entry.week}` : ""}
                </span>
                {entry.reviewStatus ? (
                  <StatusPill status={entry.reviewStatus} />
                ) : (
                  <span className={styles.rosterNoReview}>No review yet</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className={styles.railFooter}>
          <p className={styles.viewer}>{viewerName}</p>
          <form action={signOut}>
            <button className={styles.signOut} type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main review ─────────────────────────────────────────────── */}
      <main className={styles.main}>
        {review == null ? (
          <div className={styles.empty}>
            <h1 className={styles.emptyHeading}>No review to show</h1>
            <p className={styles.emptyNote}>
              Select a patient from the roster. If this patient is new, their first weekly review
              will appear after the rehab lead issues it.
            </p>
          </div>
        ) : (
          <>
            <header className={styles.banner}>
              <div>
                <h1 className={styles.patientName}>{review.patient.fullName}</h1>
                <p className={styles.patientMeta}>
                  {review.patient.mrn} · Week {review.weekNo} ·{" "}
                  {formatDateRange(review.windowStart, review.windowEnd)}
                </p>
              </div>
              {review.status ? <StatusPill status={review.status} /> : null}
            </header>

            {/* Status strip: clinical context, CONSULTANT-ONLY (holds MRD). */}
            <section className={styles.statusStrip} aria-label="Clinical context">
              {Object.entries(CONTEXT_LABELS).map(([key, label]) =>
                review.context[key] ? (
                  <div key={key} className={styles.stripItem}>
                    <span className={styles.stripLabel}>{label}</span>
                    <span className={styles.stripValue}>{review.context[key]}</span>
                  </div>
                ) : null,
              )}
            </section>

            <div className={styles.scoreRow}>
              <section className={styles.scoreCard} aria-label="Composite score">
                <span className={styles.scoreValue}>
                  {review.compositeScore != null ? review.compositeScore.toFixed(1) : "–"}
                </span>
                <span className={styles.scoreLabel}>Composite score</span>
                <span className={styles.scoreCaption}>out of 10, all three pillars</span>
              </section>

              {review.pillars.map((pillar) => (
                <section
                  key={pillar.pillar}
                  className={styles.pillarScoreCard}
                  aria-label={`${pillar.label} score`}
                >
                  <span
                    className={`${styles.pillarScoreValue} ${
                      pillar.score != null && pillar.score < 8 ? styles.pillarScoreAmber : ""
                    }`}
                  >
                    {pillar.score != null ? pillar.score.toFixed(1) : "–"}
                  </span>
                  <span className={styles.pillarScoreLabel}>{pillar.label}</span>
                  <span className={styles.pillarScoreBaseline}>
                    {pillar.baseline != null ? `Baseline ${pillar.baseline.toFixed(1)}` : ""}
                  </span>
                </section>
              ))}
            </div>

            {review.pillars.map((pillar) => (
              <section key={pillar.pillar} className={styles.pillarSection}>
                <header className={styles.pillarHeader}>
                  <h2 className={styles.pillarTitle}>{pillar.label}</h2>
                </header>
                <div className={styles.metricTable} role="table" aria-label={`${pillar.label} metrics`}>
                  {pillar.metrics.map((metric) => (
                    <div key={metric.code} className={styles.metricRow} role="row">
                      <div className={styles.metricName} role="cell">
                        <span>{metric.name}</span>
                        {metric.isEstimate ? (
                          <span className={styles.estimateChip}>estimate, not a lab measure</span>
                        ) : null}
                        <span className={styles.metricTarget}>
                          {metric.targetText}
                          {metric.unit ? ` ${metric.unit}` : ""}
                        </span>
                      </div>
                      <div className={styles.metricSpark} role="cell">
                        <Sparkline values={metric.history} />
                      </div>
                      <div className={styles.metricNumbers} role="cell">
                        <span className={styles.metricCurrent}>{metric.current}</span>
                        <span className={styles.metricPrev}>
                          from {metric.previous} · {metric.deltaText}
                        </span>
                      </div>
                      <div className={styles.metricStatus} role="cell">
                        {metric.status ? <StatusPill status={metric.status} /> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            <section className={styles.actionsPanel} aria-label="Actions and flags">
              <h2 className={styles.actionsTitle}>Actions and flags</h2>
              <ul className={styles.actionsList}>
                {review.actions.map((action) => (
                  <li
                    key={action.id}
                    className={`${styles.actionItem} ${action.isFlag ? styles.actionFlag : ""}`}
                  >
                    <div className={styles.actionTags}>
                      {action.isFlag ? <StatusPill status="flag" /> : null}
                      {action.clientVisible ? (
                        <span className={styles.sharedChip}>Shared with client</span>
                      ) : (
                        <span className={styles.clinicalChip}>Clinical team only</span>
                      )}
                    </div>
                    <p className={styles.actionText}>{action.text}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.signOff} aria-label="Sign-off">
              <h2 className={styles.actionsTitle}>Sign-off</h2>
              <p className={styles.signOffText}>
                {review.issuedByName
                  ? `Issued by ${review.issuedByName} on ${formatDate(review.issuedAt)}.`
                  : "Not yet issued."}{" "}
                {review.signedByName
                  ? `Signed off by ${review.signedByName} on ${formatDate(review.signedAt)}.`
                  : "Not yet signed off. Audited sign-off arrives in Phase 2."}
              </p>
            </section>

            <p className={styles.disclaimer}>
              Rehabilitation monitoring tool. Supports the medical team; it does not replace
              clinical care. Wearable-derived values are estimates, not lab measures.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
