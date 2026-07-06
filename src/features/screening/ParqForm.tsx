"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitParq, type ParqState } from "./actions";
import { PARQ_QUESTIONS } from "./parq";
import styles from "./screening.module.css";

const initial: ParqState = { error: null, done: false };

/**
 * The PAR-Q readiness screening, prompted at sign-on and skippable ("Do this
 * later"). Seven yes/no questions; answers live on the client's health
 * profile and a yes answer asks the team to follow up, framed supportively,
 * never as a barrier.
 */
export function ParqForm() {
  const [state, action, pending] = useActionState(submitParq, initial);

  if (state.done) {
    return (
      <div className={styles.doneCard}>
        <h2 className={styles.doneTitle}>Thank you, that is saved</h2>
        <p className={styles.note}>
          Your answers are kept with your clinical details, and your team will look at them before
          your next session. Nothing here changes your programme on its own.
        </p>
        <Link className={styles.doneLink} href="/app">
          Back to your week
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className={styles.form}>
      {PARQ_QUESTIONS.map((q, i) => (
        <fieldset key={q.code} className={styles.question}>
          <legend className={styles.questionText}>
            {i + 1}. {q.text}
          </legend>
          <div className={styles.answers}>
            <label className={styles.answer}>
              <input type="radio" name={q.code} value="yes" required /> Yes
            </label>
            <label className={styles.answer}>
              <input type="radio" name={q.code} value="no" required /> No
            </label>
          </div>
        </fieldset>
      ))}

      <p className={styles.note}>
        Answering yes to a question does not stop you exercising. It simply tells your team what to
        check so your programme stays safe and right for you.
      </p>

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save my answers"}
        </button>
        <Link className={styles.later} href="/app">
          Do this later
        </Link>
      </div>
    </form>
  );
}
