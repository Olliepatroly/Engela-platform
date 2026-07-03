import Link from "next/link";
import { BodyMap, MUSCLE_LABELS, StatusPill } from "@/components/ui";
import {
  AddLibraryExerciseForm,
  AddSessionExerciseForm,
  AddSessionForm,
  CreateProgramForm,
} from "./BuilderPanels";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  formatPrescription,
  type ExerciseOption,
  type ProgramVM,
  type SessionDetailVM,
  type SessionStatus,
  type SessionSummaryVM,
} from "./data";
import styles from "./programs.module.css";

export function formatSessionDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

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
              href={`/console/programs?patient=${clientId}&session=${s.id}`}
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
  library,
}: {
  detail: SessionDetailVM;
  figure: "male" | "female";
  clientId: string;
  canBuild: boolean;
  library: ExerciseOption[];
}) {
  return (
    <>
      <section className={styles.breakdown} aria-label="Session breakdown">
        <header className={styles.breakdownHeader}>
          <div>
            <Link className={styles.backLink} href={`/console/programs?patient=${clientId}`}>
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
                        </span>
                        <span className={e.completed ? styles.doneMark : styles.pendingMark}>
                          {e.completed ? "✓ Done" : "Planned"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <aside className={styles.bodyMapPanel} aria-label="Muscles worked">
            <h3 className={styles.categoryTitle}>Muscles worked</h3>
            <BodyMap
              figure={figure}
              primary={detail.primaryMuscles}
              secondary={detail.secondaryMuscles}
            />
          </aside>
        </div>
      </section>

      {canBuild ? <AddSessionExerciseForm sessionId={detail.id} library={library} /> : null}
    </>
  );
}

/**
 * Exercise programmes surface for the clinical team. Everyone on the care
 * team reads; building (programmes, sessions, the exercise library) is the
 * exercise physiologist's capability.
 */
export function ProgramsView({
  patient,
  program,
  sessionDetail,
  library,
  canBuild,
}: {
  patient: { clientId: string; fullName: string; mrn: string } | null;
  program: ProgramVM | null;
  sessionDetail: SessionDetailVM | null;
  library: ExerciseOption[];
  canBuild: boolean;
}) {
  if (!patient) {
    return (
      <div className={styles.empty}>
        <h1 className={styles.emptyHeading}>Exercise programmes</h1>
        <p className={styles.emptyNote}>Select a patient from the roster to see their programme.</p>
      </div>
    );
  }

  return (
    <>
      <header className={styles.banner}>
        <div>
          <h1 className={styles.patientName}>{patient.fullName}</h1>
          <p className={styles.patientMeta}>{patient.mrn} · Exercise programme</p>
        </div>
      </header>

      {program == null ? (
        <section className={styles.programCard}>
          <h2 className={styles.programTitle}>No programme yet</h2>
          <p className={styles.emptyNote}>
            {canBuild
              ? "Start a programme below, then add sessions and exercises."
              : "The exercise physiologist has not started a programme for this client yet."}
          </p>
        </section>
      ) : (
        <section className={styles.programCard}>
          <h2 className={styles.programTitle}>{program.title}</h2>
          {program.focus ? <p className={styles.programFocus}>{program.focus}</p> : null}
          <p className={styles.programMeta}>
            {program.startsOn ? `Started ${formatSessionDate(program.startsOn)}` : "Start date not set"}
            {program.createdByName ? ` · Built by ${program.createdByName}` : ""}
          </p>
        </section>
      )}

      {sessionDetail ? (
        <SessionBreakdown
          detail={sessionDetail}
          figure={program?.bodyMap ?? "male"}
          clientId={patient.clientId}
          canBuild={canBuild}
          library={library}
        />
      ) : program ? (
        <div className={styles.listsGrid}>
          <SessionList
            heading="Upcoming sessions"
            sessions={program.upcoming}
            clientId={patient.clientId}
            emptyText="Nothing scheduled ahead."
          />
          <SessionList
            heading="History"
            sessions={program.history}
            clientId={patient.clientId}
            emptyText="No sessions yet."
          />
        </div>
      ) : null}

      {canBuild ? (
        <section className={styles.builder} aria-label="Programme builder">
          <h2 className={styles.builderTitle}>Build</h2>
          <div className={styles.builderGrid}>
            {program ? <AddSessionForm programId={program.id} /> : null}
            <CreateProgramForm clientId={patient.clientId} />
            <AddLibraryExerciseForm />
          </div>
        </section>
      ) : null}
    </>
  );
}
