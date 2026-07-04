"use client";

import { useActionState } from "react";
import { signOffReview, type EntryState } from "./entry-actions";
import styles from "./console.module.css";

const initial: EntryState = { error: null, success: null };

/**
 * Sign-off for the selected weekly review. Shows the issued/signed record to
 * every clinical role; the sign-off form itself appears only for the
 * consultant (or admin) while the review is unsigned. Signing off is an
 * audited event: it writes signer + timestamp to the review and appends to
 * the audit trail.
 */
export function SignOffPanel({
  clientId,
  reviewId,
  weekNo,
  patientName,
  issuedText,
  signedText,
  isSigned,
  canSignOff,
}: {
  clientId: string;
  reviewId: string;
  weekNo: number;
  patientName: string;
  issuedText: string;
  signedText: string;
  isSigned: boolean;
  canSignOff: boolean;
}) {
  const [state, action, pending] = useActionState(signOffReview, initial);

  return (
    <section className={styles.signOff} aria-label="Sign-off">
      <h2 className={styles.actionsTitle}>Sign-off</h2>
      <p className={styles.signOffText}>
        {issuedText} {signedText}
      </p>

      {!isSigned && canSignOff ? (
        <form className={styles.signOffForm} action={action}>
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="reviewId" value={reviewId} />
          <label className={styles.signOffCheck}>
            <input type="checkbox" name="confirmed" required />
            <span>
              I have reviewed week {weekNo} for {patientName}: the readings, scores, actions and
              flags above.
            </span>
          </label>
          {state.error ? (
            <p className={styles.signOffError} role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? <p className={styles.signOffSuccess}>{state.success}</p> : null}
          <button className={styles.signOffButton} type="submit" disabled={pending}>
            {pending ? "Signing off…" : `Sign off week ${weekNo}`}
          </button>
          <p className={styles.signOffCaption}>
            Recorded with your name and the time in the audit trail. A signed review cannot be
            unsigned.
          </p>
        </form>
      ) : null}

      {!isSigned && !canSignOff ? (
        <p className={styles.signOffCaption}>The consultant signs off the weekly review.</p>
      ) : null}
    </section>
  );
}
