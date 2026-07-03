"use client";

import { useActionState } from "react";
import { setCategoryDone, type ProgramActionState } from "./actions";
import type { ExerciseCategory } from "./constants";
import styles from "./client-program.module.css";

const initial: ProgramActionState = { error: null, success: null };

/**
 * The client marks one part of the session done (cardiovascular, resistance
 * or mobility each complete separately). Reopening is one tap: no guilt, no
 * friction.
 */
export function CategoryToggle({
  sessionId,
  category,
  label,
  done,
}: {
  sessionId: string;
  category: ExerciseCategory;
  label: string;
  done: boolean;
}) {
  const [state, action, pending] = useActionState(setCategoryDone, initial);
  return (
    <form className={styles.toggleForm} action={action}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="done" value={done ? "0" : "1"} />
      <button
        className={done ? styles.reopenBtn : styles.completeBtn}
        type="submit"
        disabled={pending}
      >
        {pending ? "Saving…" : done ? `Reopen ${label.toLowerCase()}` : `Mark ${label.toLowerCase()} done`}
      </button>
      {state.error ? (
        <p className={styles.toggleError} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p className={styles.toggleSuccess}>{state.success}</p> : null}
    </form>
  );
}
