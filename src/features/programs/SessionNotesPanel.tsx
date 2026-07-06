"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveSessionNotes, type ProgramActionState } from "./actions";
import styles from "./programs.module.css";

const initial: ProgramActionState = { error: null, success: null };

/**
 * Session notes for the training team: screening observations, effort, how
 * the client responded. Editable by CEP/physio/admin; read-only for the rest
 * of the team. Anything concerning belongs in a clinical flag with SBAR, so
 * the panel links straight to the prompt with client + session prefilled.
 */
export function SessionNotesPanel({
  sessionId,
  clientId,
  notes,
  canEdit,
}: {
  sessionId: string;
  clientId: string;
  notes: string | null;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(saveSessionNotes, initial);

  return (
    <section className={styles.notesPanel} aria-label="Session notes">
      <div className={styles.notesHeader}>
        <h3 className={styles.categoryTitle}>Session notes</h3>
        <Link
          className={styles.raiseFlagLink}
          href={`/console/flags?client=${clientId}&session=${sessionId}`}
        >
          Raise a clinical flag
        </Link>
      </div>

      {canEdit ? (
        <form action={action} className={styles.notesForm}>
          <input type="hidden" name="sessionId" value={sessionId} />
          <textarea
            className={styles.notesInput}
            name="notes"
            rows={4}
            maxLength={4000}
            defaultValue={notes ?? ""}
            placeholder="Screening observations, effort, response to the session, anything the team should know. Raise anything concerning as a flag."
          />
          {state.error ? (
            <p className={styles.formError} role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? <p className={styles.formSuccess}>{state.success}</p> : null}
          <button className={styles.notesSave} type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save notes"}
          </button>
        </form>
      ) : (
        <p className={styles.notesReadOnly}>{notes?.trim() ? notes : "No notes for this session yet."}</p>
      )}
    </section>
  );
}
