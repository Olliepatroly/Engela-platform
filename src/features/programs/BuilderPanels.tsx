"use client";

import { useActionState } from "react";
import { MUSCLE_LABELS, type MuscleGroup } from "@/components/ui";
import {
  addExerciseToLibrary,
  addSession,
  addSessionExercise,
  createProgram,
  updateProgram,
  type ProgramActionState,
} from "./actions";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  formatSessionDate,
  type ExerciseOption,
} from "./constants";
import styles from "./programs.module.css";

const initial: ProgramActionState = { error: null, success: null };

function Feedback({ state }: { state: ProgramActionState }) {
  if (state.error) {
    return (
      <p className={styles.formError} role="alert">
        {state.error}
      </p>
    );
  }
  if (state.success) return <p className={styles.formSuccess}>{state.success}</p>;
  return null;
}

/** Start a block for the selected client (archives any previous one). */
export function CreateProgramForm({ clientId }: { clientId: string }) {
  const [state, action, pending] = useActionState(createProgram, initial);
  return (
    <form className={styles.builderForm} action={action}>
      <h3 className={styles.builderFormTitle}>Start a block</h3>
      <input type="hidden" name="clientId" value={clientId} />
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Title</span>
        <input className={styles.input} name="title" required placeholder="e.g. Rebuild strength, block 1" />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Focus (shown to the client)</span>
        <textarea className={styles.textarea} name="focus" rows={2} placeholder="What this block is about" />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Starts on</span>
        <input className={styles.input} type="date" name="startsOn" />
      </label>
      <Feedback state={state} />
      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Create block"}
      </button>
    </form>
  );
}

/** Edit an existing block: title, focus, start date, status. */
export function BlockEditForm({
  block,
}: {
  block: {
    id: string;
    title: string;
    focus: string | null;
    startsOn: string | null;
    status: "active" | "completed" | "archived";
  };
}) {
  const [state, action, pending] = useActionState(updateProgram, initial);
  return (
    <form className={styles.builderForm} action={action}>
      <input type="hidden" name="programId" value={block.id} />
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Title</span>
        <input className={styles.input} name="title" required defaultValue={block.title} />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Focus (shown to the client)</span>
        <textarea
          className={styles.textarea}
          name="focus"
          rows={2}
          defaultValue={block.focus ?? ""}
        />
      </label>
      <div className={styles.prescriptionRow}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Starts on</span>
          <input
            className={styles.input}
            type="date"
            name="startsOn"
            defaultValue={block.startsOn ?? ""}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Status</span>
          <select className={styles.input} name="status" defaultValue={block.status}>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>
      <Feedback state={state} />
      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save block"}
      </button>
    </form>
  );
}

/** Add a dated session to the active programme. */
export function AddSessionForm({ programId }: { programId: string }) {
  const [state, action, pending] = useActionState(addSession, initial);
  return (
    <form className={styles.builderForm} action={action}>
      <h3 className={styles.builderFormTitle}>Add a session</h3>
      <input type="hidden" name="programId" value={programId} />
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Session title</span>
        <input className={styles.input} name="title" required placeholder="e.g. Strength and steadiness A" />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Date</span>
        <input className={styles.input} type="date" name="scheduledFor" required />
      </label>
      <Feedback state={state} />
      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add session"}
      </button>
    </form>
  );
}

/**
 * Add an exercise with its prescription to a session: either the open one
 * (fixed sessionId) or one picked from the upcoming list (planning page).
 */
export function AddSessionExerciseForm({
  sessionId,
  sessions,
  library,
}: {
  sessionId?: string;
  sessions?: { id: string; title: string; scheduledFor: string }[];
  library: ExerciseOption[];
}) {
  const [state, action, pending] = useActionState(addSessionExercise, initial);
  return (
    <form className={styles.builderForm} action={action}>
      <h3 className={styles.builderFormTitle}>
        {sessionId ? "Add an exercise to this session" : "Add an exercise to a session"}
      </h3>
      {sessionId ? (
        <input type="hidden" name="sessionId" value={sessionId} />
      ) : (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Session</span>
          <select className={styles.input} name="sessionId" required defaultValue="">
            <option value="" disabled>
              Choose a session
            </option>
            {(sessions ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {formatSessionDate(s.scheduledFor)} · {s.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Exercise</span>
        <select className={styles.input} name="exerciseId" required defaultValue="">
          <option value="" disabled>
            Choose from the library
          </option>
          {CATEGORY_ORDER.map((cat) => (
            <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
              {library
                .filter((e) => e.category === cat)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className={styles.prescriptionRow}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Sets</span>
          <input className={styles.input} type="number" name="sets" min="1" max="20" />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Reps</span>
          <input className={styles.input} type="number" name="reps" min="1" max="100" />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Weight (kg)</span>
          <input className={styles.input} type="number" step="0.5" name="weightKg" min="0" />
        </label>
      </div>
      <div className={styles.prescriptionRow}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Minutes</span>
          <input className={styles.input} type="number" step="0.5" name="durationMin" min="0" />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Distance (km)</span>
          <input className={styles.input} type="number" step="0.1" name="distanceKm" min="0" />
        </label>
      </div>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Notes (optional)</span>
        <input className={styles.input} name="notes" placeholder="e.g. Each leg, hold 30 seconds" />
      </label>
      <Feedback state={state} />
      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add exercise"}
      </button>
    </form>
  );
}

const MUSCLE_OPTIONS = Object.entries(MUSCLE_LABELS) as [MuscleGroup, string][];

/** Grow the shared exercise library (CEP capability). */
export function AddLibraryExerciseForm() {
  const [state, action, pending] = useActionState(addExerciseToLibrary, initial);
  return (
    <form className={styles.builderForm} action={action}>
      <h3 className={styles.builderFormTitle}>Add an exercise to the library</h3>
      <p className={styles.builderFormNote}>
        Available to every programme once saved. Pick the muscle groups so the body map can show
        what each session works.
      </p>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Name</span>
        <input className={styles.input} name="name" required placeholder="e.g. Incline treadmill walk" />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Category</span>
        <select className={styles.input} name="category" required defaultValue="">
          <option value="" disabled>
            Choose a category
          </option>
          {CATEGORY_ORDER.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </label>
      <fieldset className={styles.muscleFieldset}>
        <legend className={styles.fieldLabel}>Primary muscles</legend>
        <div className={styles.muscleGrid}>
          {MUSCLE_OPTIONS.map(([value, label]) => (
            <label key={value} className={styles.muscleCheck}>
              <input type="checkbox" name="primaryMuscles" value={value} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className={styles.muscleFieldset}>
        <legend className={styles.fieldLabel}>Also involved (optional)</legend>
        <div className={styles.muscleGrid}>
          {MUSCLE_OPTIONS.map(([value, label]) => (
            <label key={value} className={styles.muscleCheck}>
              <input type="checkbox" name="secondaryMuscles" value={value} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Equipment</span>
        <input className={styles.input} name="equipment" placeholder="e.g. Dumbbells" />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>How to do it (shown to the client)</span>
        <textarea className={styles.textarea} name="instructions" rows={3} />
      </label>
      <Feedback state={state} />
      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add to library"}
      </button>
    </form>
  );
}
