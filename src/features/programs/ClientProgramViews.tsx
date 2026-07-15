import Link from "next/link";
import { CategoryToggle } from "./CategoryToggle";
import { SessionEffortMap } from "./SessionEffortMap";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  formatPrescription,
  type ProgramVM,
  type SessionDetailVM,
  type SessionSummaryVM,
} from "./data";
import styles from "./client-program.module.css";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function SessionCard({ session }: { session: SessionSummaryVM }) {
  return (
    <Link className={styles.sessionCard} href={`/app/program/${session.id}`}>
      <span className={styles.sessionCardDate}>{shortDate(session.scheduledFor)}</span>
      <span className={styles.sessionCardTitle}>{session.title}</span>
      <span className={styles.sessionCardMeta}>
        {session.categories.map((c) => CATEGORY_LABELS[c]).join(" · ")}
      </span>
      <span
        className={
          session.status === "completed"
            ? styles.sessionDone
            : session.status === "missed"
              ? styles.sessionSkipped
              : styles.sessionPlanned
        }
      >
        {session.status === "completed"
          ? "✓ Done"
          : session.status === "missed"
            ? "Skipped"
            : session.completedCount > 0
              ? `${session.completedCount} of ${session.exerciseCount} done`
              : "Planned"}
      </span>
    </Link>
  );
}

/** The client's programme home: next session, what is coming, what is done. */
export function ClientProgramView({ program }: { program: ProgramVM | null }) {
  if (!program) {
    return (
      <section className={styles.emptyCard}>
        <h2 className={styles.emptyHeading}>Your programme is on its way</h2>
        <p className={styles.emptyNote}>
          Your exercise physiologist is putting your plan together. It will appear here as soon as
          it is ready.
        </p>
      </section>
    );
  }

  const next = program.upcoming[0] ?? null;
  const later = program.upcoming.slice(1);

  return (
    <div className={styles.wrap}>
      <section className={styles.programIntro}>
        <h2 className={styles.programTitle}>{program.title}</h2>
        {program.focus ? <p className={styles.programFocus}>{program.focus}</p> : null}
        {program.createdByName ? (
          <p className={styles.programBy}>Built for you by {program.createdByName}</p>
        ) : null}
      </section>

      {next ? (
        <section aria-label="Next session">
          <h3 className={styles.sectionTitle}>Next up</h3>
          <Link className={styles.nextCard} href={`/app/program/${next.id}`}>
            <span className={styles.nextDate}>{formatDate(next.scheduledFor)}</span>
            <span className={styles.nextTitle}>{next.title}</span>
            <span className={styles.nextMeta}>
              {next.categories.map((c) => CATEGORY_LABELS[c]).join(" · ")} · {next.exerciseCount}{" "}
              exercises
            </span>
          </Link>
        </section>
      ) : null}

      {later.length > 0 ? (
        <section aria-label="Coming up">
          <h3 className={styles.sectionTitle}>Coming up</h3>
          <div className={styles.sessionGrid}>
            {later.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-label="What you have done">
        <h3 className={styles.sectionTitle}>What you have done</h3>
        {program.history.length === 0 ? (
          <p className={styles.emptyNote}>Your first session is still ahead of you.</p>
        ) : (
          <div className={styles.sessionGrid}>
            {program.history.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** One session: what it includes, mark each part done, muscles worked. */
export function ClientSessionView({
  detail,
  figure,
}: {
  detail: SessionDetailVM;
  figure: "male" | "female";
}) {
  return (
    <div className={styles.wrap}>
      <section className={styles.sessionHeader}>
        <h2 className={styles.programTitle}>{detail.title}</h2>
        <p className={styles.sessionHeaderMeta}>
          {formatDate(detail.scheduledFor)} · {detail.programTitle}
        </p>
        {detail.status === "completed" ? (
          <p className={styles.sessionHeaderDone}>✓ Completed. Lovely work.</p>
        ) : detail.status === "missed" ? (
          <p className={styles.sessionHeaderSkipped}>
            This one was skipped. That is okay: rest protects progress too.
          </p>
        ) : null}
      </section>

      {CATEGORY_ORDER.map((cat) => {
        const entries = detail.exercises.filter((e) => e.category === cat);
        if (entries.length === 0) return null;
        const allDone = entries.every((e) => e.completed);
        return (
          <section key={cat} className={styles.categoryCard} aria-label={CATEGORY_LABELS[cat]}>
            <header className={styles.categoryHeader}>
              <h3 className={styles.categoryTitle}>{CATEGORY_LABELS[cat]}</h3>
              {allDone ? <span className={styles.sessionDone}>✓ Done</span> : null}
            </header>
            <ul className={styles.exerciseList}>
              {entries.map((e) => (
                <li key={e.id} className={styles.exerciseItem}>
                  <div className={styles.exerciseTop}>
                    <span className={e.completed ? styles.exerciseNameDone : styles.exerciseName}>
                      {e.name}
                    </span>
                    <span className={styles.exercisePrescription}>
                      {formatPrescription(e) || "As guided"}
                    </span>
                  </div>
                  {e.notes ? <p className={styles.exerciseNotes}>{e.notes}</p> : null}
                  {e.instructions ? (
                    <details className={styles.howTo}>
                      <summary>How to do it</summary>
                      <p>{e.instructions}</p>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
            <CategoryToggle
              sessionId={detail.id}
              category={cat}
              label={CATEGORY_LABELS[cat]}
              done={allDone}
            />
          </section>
        );
      })}

      {detail.effortRegions.length > 0 ? (
        <section className={styles.bodyMapCard} aria-label="How hard it felt">
          <h3 className={styles.categoryTitle}>How hard did it feel?</h3>
          <p className={styles.bodyMapNote}>
            Tap each muscle you worked and rate how hard it felt, from 0 (rest) to 10 (as hard as
            you could go). There are no wrong answers: it helps your team pace you well.
          </p>
          <SessionEffortMap
            sessionId={detail.id}
            regions={detail.effortRegions}
            aimed={detail.aimedByMuscle}
            effort={detail.effortByMuscle}
            figure={figure}
          />
        </section>
      ) : null}

      <p className={styles.disclaimer}>
        Go at your own pace. If anything feels wrong, stop and let your community know: easing off
        is protective, not a setback.
      </p>
    </div>
  );
}
