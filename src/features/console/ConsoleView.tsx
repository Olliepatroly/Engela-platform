import type { ReactNode } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/ui";
import { Sidebar } from "./Sidebar";
import { AddDataPanel, type MetricOption } from "./AddDataPanel";
import { ClientStatusPanel } from "./ClientStatusPanel";
import { ConductReviewPanel } from "./ConductReviewPanel";
import { MetricTable } from "./MetricTable";
import { ScoreRadar } from "./ScoreRadar";
import { SignOffPanel } from "./SignOffPanel";
import type { ClientStatusVM, ReviewDraftVM, ReviewVM, ReviewWeekVM, RosterEntry } from "./data";
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
  selectedClient,
  draft,
  clientStatus,
  weeks,
  viewerName,
  viewerCanSignOff,
  metricOptions,
  reportsSlot,
}: {
  roster: RosterEntry[];
  review: ReviewVM | null;
  /** The patient on screen, which exists even before their first review does. */
  selectedClient: { clientId: string; fullName: string } | null;
  /** Starting values for conducting the next review (null with no patient). */
  draft: ReviewDraftVM | null;
  /** Where the record sits: active, paused or discharged (null with no patient). */
  clientStatus: ClientStatusVM | null;
  weeks: ReviewWeekVM[];
  viewerName: string;
  viewerCanSignOff: boolean;
  metricOptions: MetricOption[];
  /** Reports panel, composed by the page so features stay independent. */
  reportsSlot?: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <Sidebar
        roster={roster}
        viewerName={viewerName}
        selectedId={review?.patient.clientId ?? selectedClient?.clientId}
        activeNav="review"
      />

      <main className={styles.main}>
        {review == null ? (
          selectedClient && draft ? (
            <>
              <header className={styles.banner}>
                <div>
                  <h1 className={styles.patientName}>{selectedClient.fullName}</h1>
                  <p className={styles.patientMeta}>No review on this record yet</p>
                </div>
              </header>
              <ConductReviewPanel
                clientId={selectedClient.clientId}
                patientName={selectedClient.fullName}
                draft={draft}
              />
              {reportsSlot}
              {clientStatus ? (
                <ClientStatusPanel
                  clientId={selectedClient.clientId}
                  patientName={selectedClient.fullName}
                  status={clientStatus.status}
                  changedByName={clientStatus.changedByName}
                  changedAt={clientStatus.changedAt}
                />
              ) : null}
            </>
          ) : (
            <div className={styles.empty}>
              <h1 className={styles.emptyHeading}>No review to show</h1>
              <p className={styles.emptyNote}>
                Select a patient from the roster to see their week, or to conduct their first
                review.
              </p>
            </div>
          )
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

            {weeks.length > 1 ? (
              <nav className={styles.weekNav} aria-label="Weeks on this record">
                <span className={styles.weekNavLabel}>Weeks</span>
                {weeks.map((week) => (
                  <Link
                    key={week.reviewId}
                    className={styles.weekLink}
                    href={`/console/review?patient=${review.patient.clientId}&week=${week.weekNo}`}
                    aria-current={week.weekNo === review.weekNo ? "page" : undefined}
                    data-active={week.weekNo === review.weekNo ? "true" : undefined}
                  >
                    {week.weekNo}
                    {week.isSigned ? <span aria-hidden="true"> ✓</span> : null}
                    <span className={styles.srOnly}>
                      {week.isSigned ? " signed off" : " not yet signed off"}
                    </span>
                  </Link>
                ))}
              </nav>
            ) : null}

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

            {review.summary ? (
              <section className={styles.summaryPanel} aria-label="Review notes">
                <h2 className={styles.actionsTitle}>Review notes</h2>
                <p className={styles.summaryText}>{review.summary}</p>
              </section>
            ) : null}

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

            <ScoreRadar pillars={review.pillars} composite={review.compositeScore} />

            {review.pillars.map((pillar) => (
              <section key={pillar.pillar} className={styles.pillarSection}>
                <header className={styles.pillarHeader}>
                  <h2 className={styles.pillarTitle}>{pillar.label}</h2>
                </header>
                <MetricTable label={pillar.label} metrics={pillar.metrics} />
              </section>
            ))}

            <section className={styles.actionsPanel} aria-label="Actions and flags">
              <h2 className={styles.actionsTitle}>Actions and flags</h2>
              {review.actions.length === 0 ? (
                <p className={styles.noMetrics}>No actions this week.</p>
              ) : null}
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

            <AddDataPanel
              clientId={review.patient.clientId}
              reviewId={review.reviewId}
              weekNo={review.weekNo}
              metricOptions={metricOptions}
            />

            {reportsSlot}

            <SignOffPanel
              clientId={review.patient.clientId}
              reviewId={review.reviewId}
              weekNo={review.weekNo}
              patientName={review.patient.fullName}
              issuedText={
                review.issuedByName
                  ? `Issued by ${review.issuedByName} on ${formatDate(review.issuedAt)}.`
                  : "Not yet issued."
              }
              signedText={
                review.signedByName
                  ? `Signed off by ${review.signedByName} on ${formatDate(review.signedAt)}.`
                  : "Not yet signed off."
              }
              isSigned={review.signedAt != null}
              canSignOff={viewerCanSignOff}
            />

            {draft ? (
              <ConductReviewPanel
                clientId={review.patient.clientId}
                patientName={review.patient.fullName}
                draft={draft}
              />
            ) : null}

            {clientStatus ? (
              <ClientStatusPanel
                clientId={review.patient.clientId}
                patientName={review.patient.fullName}
                status={clientStatus.status}
                changedByName={clientStatus.changedByName}
                changedAt={clientStatus.changedAt}
              />
            ) : null}

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
