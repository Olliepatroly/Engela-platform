"use client";

import { useActionState } from "react";
import { openReview, type EntryState } from "./entry-actions";
import type { ReviewDraftVM } from "./data";
import styles from "./conduct-review.module.css";

const initial: EntryState = { error: null, success: null };

/**
 * Conduct a weekly review, or submit one carried out earlier.
 *
 * Any clinical role on the client's care team can open a week: it is the
 * record everything else hangs off, so until a week exists there is nowhere to
 * put a reading, an action or a report. The dates default to the week we are
 * in; change "conducted on" and the window to enter a review a colleague ran
 * earlier (a consultant's clinic review, say) with its real dates. The
 * consultant still signs it off.
 */
export function ConductReviewPanel({
  clientId,
  patientName,
  draft,
}: {
  clientId: string;
  patientName: string;
  draft: ReviewDraftVM;
}) {
  const [state, action, pending] = useActionState(openReview, initial);

  return (
    <section className={styles.panel} aria-label="Conduct a review">
      <h2 className={styles.title}>
        {draft.hasEarlierReview ? "Conduct the next review" : `Start ${patientName}'s record`}
      </h2>
      <p className={styles.note}>
        {draft.hasEarlierReview
          ? "Open the next week so the team can record against it. To submit a review conducted earlier, set the date it was conducted and the week it covers."
          : "This client has no review yet, so there is nowhere to record readings, actions or reports. Opening their first week starts the record and sets the baseline everything is measured against."}{" "}
        Any of the clinical team can conduct a review; the consultant signs it off.
      </p>

      <form className={styles.form} action={action}>
        <input type="hidden" name="clientId" value={clientId} />

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Week number</span>
            <input
              className={styles.input}
              type="number"
              name="weekNo"
              min={1}
              max={520}
              required
              defaultValue={draft.weekNo}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Conducted on</span>
            <input
              className={styles.input}
              type="date"
              name="conductedOn"
              required
              defaultValue={draft.conductedOn}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Week from</span>
            <input
              className={styles.input}
              type="date"
              name="windowStart"
              required
              defaultValue={draft.windowStart}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Week to</span>
            <input
              className={styles.input}
              type="date"
              name="windowEnd"
              required
              defaultValue={draft.windowEnd}
            />
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Review notes (optional)</span>
          <textarea
            className={styles.textarea}
            name="summary"
            rows={3}
            maxLength={4000}
            placeholder="What this review covered, and who conducted it if it was carried out elsewhere"
          />
        </label>

        {state.error ? (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? <p className={styles.success}>{state.success}</p> : null}

        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? "Opening…" : draft.hasEarlierReview ? "Open this review" : "Start the record"}
        </button>
        <p className={styles.caption}>
          Recorded with your name and the time in the audit trail. Readings, actions and reports
          then attach to this week.
        </p>
      </form>
    </section>
  );
}
