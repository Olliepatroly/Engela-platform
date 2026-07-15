import Link from "next/link";
import { MUSCLE_LABELS, StatusPill } from "@/components/ui";
import { AddSessionExerciseForm } from "./BuilderPanels";
import { CategoryToggle } from "./CategoryToggle";
import { SessionEffortMap } from "./SessionEffortMap";
import { SessionNotesPanel } from "./SessionNotesPanel";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  formatPrescription,
  formatSessionDate,
  type SessionStatus,
} from "./constants";
import type { ExerciseOption, ProgramVM, SessionDetailVM, SessionSummaryVM } from "./data";
import styles from "./programs.module.css";

function SessionStatusPill({ status }: { status: SessionStatus }) {
  if (status === "completed") return <StatusPill status="on_track" label="Completed" />;
  if (status === "missed") return <StatusPill status="watch" label="Missed" />;
  return <span className={styles.scheduledChip}>Scheduled</span>;
}

function SessionList({
  heading,
  sessions,
  clientId,
  emptyText,
}: {
  heading: string;
  sessions: SessionSummaryVM[];
  clientId: string;
  emptyText: string;
}) {
  return (
    <section className={styles.sessionList} aria-label={heading}>
      <h3 className={styles.sessionListTitle}>{heading}</h3>
      {sessions.length === 0 ? <p className={styles.emptyNote}>{emptyText}</p> : null}
      <ul className={styles.sessionRows}>
        {sessions.map((s) => (
          <li key={s.id}>
            <Link
              className={styles.sessionRow}
              href={`/console/programs/sessions?patient=${clientId}&session=${s.id}`}
            >
              <span className={styles.sessionDate}>{formatSessionDate(s.scheduledFor)}</span>
              <span className={styles.sessionTitle}>{s.title}</span>
              <span className={styles.sessionCats}>
                {s.categories.map((c) => CATEGORY_LABELS[c]).join(" · ")}
              </span>
              <span className={styles.sessionCount}>
                {s.completedCount > 0 && s.completedCount < s.exerciseCount
                  ? `${s.completedCount} of ${s.exerciseCount} done`
                  : `${s.exerciseCount} exercises`}
              </span>
              <SessionStatusPill status={s.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SessionBreakdown({
  detail,
  figure,
  clientId,
  canBuild,
  canComplete,
  library,
}: {
  detail: SessionDetailVM;
  figure: "male" | "female";
  clientId: string;
  canBuild: boolean;
  canComplete: boolean;
  library: ExerciseOption[];
}) {
  return (
    <>
      <section className={styles.breakdown} aria-label="Session breakdown">
        <header className={styles.breakdownHeader}>
          <div>
            <Link
              className={styles.backLink}
              href={`/console/programs/sessions?patient=${clientId}`}
            >
              ← All sessions
            </Link>
            <h2 className={styles.breakdownTitle}>{detail.title}</h2>
            <p className={styles.breakdownMeta}>
              {formatSessionDate(detail.scheduledFor)} · {detail.programTitle}
            </p>
          </div>
          <SessionStatusPill status={detail.status} />
        </header>

        <div className={styles.breakdownGrid}>
          <div>
            {CATEGORY_ORDER.map((cat) => {
              const entries = detail.exercises.filter((e) => e.category === cat);
              if (entries.length === 0) return null;
              const allDone = entries.every((e) => e.completed);
              return (
                <div key={cat} className={styles.categoryBlock}>
                  <h3 className={styles.categoryTitle}>{CATEGORY_LABELS[cat]}</h3>
                  <ul className={styles.exerciseRows}>
                    {entries.map((e) => (
                      <li key={e.id} className={styles.exerciseRow}>
                        <div className={styles.exerciseMain}>
                          <span className={styles.exerciseName}>{e.name}</span>
                          <span className={styles.exercisePrescription}>
                            {formatPrescription(e) || "As guided"}
                            {e.notes ? ` · ${e.notes}` : ""}
                          </span>
                        </div>
                        <span className={styles.exerciseMuscles}>
                          {e.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(", ")}
                          {e.aimedIntensity != null || e.perceivedEffort != null ? (
                            <span className={styles.exerciseEffort}>
                              {e.aimedIntensity != null ? `aim ${e.aimedIntensity}/10` : ""}
                              {e.aimedIntensity != null && e.perceivedEffort != null ? " · " : ""}
                              {e.perceivedEffort != null ? `felt ${e.perceivedEffort}/10` : ""}
                            </span>
                          ) : null}
                        </span>
                        <span className={e.completed ? styles.doneMark : styles.pendingMark}>
                          {e.completed ? "✓ Done" : "Planned"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {canComplete ? (
                    <div className={styles.trainerToggle}>
                      <CategoryToggle
                        sessionId={detail.id}
                        category={cat}
                        label={CATEGORY_LABELS[cat]}
                        done={allDone}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
            {canComplete ? (
              <p className={styles.trainerNote}>
                Marking a part done here records it for the client (for sessions you take
                together). It is written to the audit trail under your name.
              </p>
            ) : null}
          </div>
          <aside className={styles.bodyMapPanel} aria-label="Reported effort">
            <h3 className={styles.categoryTitle}>Effort vs aim</h3>
            {detail.effortRegions.length > 0 ? (
              <SessionEffortMap
                sessionId={detail.id}
                regions={detail.effortRegions}
                aimed={detail.aimedByMuscle}
                effort={detail.effortByMuscle}
                figure={figure}
                readOnly
              />
            ) : (
              <p className={styles.emptyNote}>
                No muscle groups set on this session&rsquo;s exercises yet.
              </p>
            )}
          </aside>
        </div>
      </section>

      <SessionNotesPanel
        sessionId={detail.id}
        clientId={clientId}
        notes={detail.notes}
        canEdit={canComplete}
      />

      {canBuild ? <AddSessionExerciseForm sessionId={detail.id} library={library} /> : null}
    </>
  );
}

/**
 * Upcoming and completed sessions. Opening one shows the full breakdown;
 * CEPs and physios can mark parts done for sessions they take with the
 * client. Building lives on the Planning page.
 */
export function SessionsView({
  clientId,
  program,
  sessionDetail,
  library,
  canBuild,
  canComplete,
}: {
  clientId: string;
  program: ProgramVM | null;
  sessionDetail: SessionDetailVM | null;
  library: ExerciseOption[];
  canBuild: boolean;
  canComplete: boolean;
}) {
  if (sessionDetail) {
    return (
      <SessionBreakdown
        detail={sessionDetail}
        figure={program?.bodyMap ?? "male"}
        clientId={clientId}
        canBuild={canBuild}
        canComplete={canComplete}
        library={library}
      />
    );
  }

  if (!program) {
    return (
      <section className={styles.programCard}>
        <h2 className={styles.programTitle}>No active block</h2>
        <p className={styles.emptyNote}>
          {canBuild
            ? "Start a block from the Planning page, then add sessions."
            : "The exercise physiologist has not started a block for this client yet."}
        </p>
      </section>
    );
  }

  return (
    <div className={styles.listsGrid}>
      <SessionList
        heading="Upcoming sessions"
        sessions={program.upcoming}
        clientId={clientId}
        emptyText="Nothing scheduled ahead."
      />
      <SessionList
        heading="Completed and past"
        sessions={program.history}
        clientId={clientId}
        emptyText="No sessions yet."
      />
    </div>
  );
}
