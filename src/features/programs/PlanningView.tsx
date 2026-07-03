import {
  AddLibraryExerciseForm,
  AddSessionExerciseForm,
  AddSessionForm,
  CreateProgramForm,
} from "./BuilderPanels";
import type { ExerciseOption, ProgramVM } from "./data";
import styles from "./programs.module.css";

/**
 * Session and block planning: start a block, add sessions, put exercises
 * (with the prescription) into upcoming sessions, and grow the shared
 * exercise library. CEP and admin only; everyone else gets a read-only note.
 */
export function PlanningView({
  clientId,
  program,
  library,
  canBuild,
}: {
  clientId: string;
  program: ProgramVM | null;
  library: ExerciseOption[];
  canBuild: boolean;
}) {
  if (!canBuild) {
    return (
      <section className={styles.programCard}>
        <h2 className={styles.programTitle}>Planning</h2>
        <p className={styles.emptyNote}>
          Blocks and sessions are built by the exercise physiologist. You can follow everything
          from the overview, blocks and sessions pages.
        </p>
      </section>
    );
  }

  return (
    <>
      {program ? (
        <section className={styles.programCard}>
          <h2 className={styles.programTitle}>{program.title}</h2>
          <p className={styles.programMeta}>
            Active block · add sessions below, then put exercises into them.
          </p>
        </section>
      ) : (
        <section className={styles.programCard}>
          <h2 className={styles.programTitle}>No active block</h2>
          <p className={styles.emptyNote}>Start one below; any previous block is archived.</p>
        </section>
      )}

      <section className={styles.builder} aria-label="Planning">
        <div className={styles.builderGrid}>
          {program ? <AddSessionForm programId={program.id} /> : null}
          {program && program.upcoming.length > 0 ? (
            <AddSessionExerciseForm
              sessions={program.upcoming.map((s) => ({
                id: s.id,
                title: s.title,
                scheduledFor: s.scheduledFor,
              }))}
              library={library}
            />
          ) : null}
          <CreateProgramForm clientId={clientId} />
          <AddLibraryExerciseForm />
        </div>
      </section>
    </>
  );
}
