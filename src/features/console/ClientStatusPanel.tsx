"use client";

import { useActionState, useState } from "react";
import { setClientStatus, type EntryState } from "./entry-actions";
import type { ClientStatus } from "./data";
import styles from "./client-status.module.css";

const initial: EntryState = { error: null, success: null };

const OPTIONS: { value: ClientStatus; label: string; help: string }[] = [
  {
    value: "active",
    label: "Active",
    help: "On the programme. Sessions, reviews and reminders all run as normal.",
  },
  {
    value: "paused",
    label: "Paused",
    help: "A protective hold. Their home shows a calm note that the programme is on hold and their team will pick it back up.",
  },
  {
    value: "discharged",
    label: "Discharged",
    help: "The programme has finished, or they have moved on from this team. Their record stays on file.",
  },
];

/**
 * Activate, pause or discharge a client's record. Open to any clinical role on
 * their care team; the reason is required for a pause or a discharge and goes
 * to the audit trail.
 *
 * Status is never colour alone: the current state is a worded chip, and every
 * option carries a sentence saying what it does. It is not an access control,
 * which the caption says plainly so nobody reaches for it as one.
 */
export function ClientStatusPanel({
  clientId,
  patientName,
  status,
  changedByName,
  changedAt,
}: {
  clientId: string;
  patientName: string;
  status: ClientStatus;
  changedByName: string | null;
  changedAt: string | null;
}) {
  const [state, action, pending] = useActionState(setClientStatus, initial);
  const [choice, setChoice] = useState<ClientStatus>(status);

  const selected = OPTIONS.find((o) => o.value === choice) ?? OPTIONS[0]!;
  const needsReason = choice !== "active";

  return (
    <section className={styles.panel} aria-label="Record status">
      <div className={styles.head}>
        <h2 className={styles.title}>Record status</h2>
        <span className={`${styles.chip} ${styles[status]}`}>
          {OPTIONS.find((o) => o.value === status)?.label ?? status}
        </span>
      </div>

      <p className={styles.note}>
        {changedByName && changedAt
          ? `Last changed by ${changedByName} on ${new Date(changedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}.`
          : `${patientName}'s record has been active since it was created.`}
      </p>

      <form className={styles.form} action={action}>
        <input type="hidden" name="clientId" value={clientId} />

        <fieldset className={styles.options}>
          <legend className={styles.legend}>Set the status</legend>
          {OPTIONS.map((option) => (
            <label key={option.value} className={styles.option}>
              <input
                type="radio"
                name="status"
                value={option.value}
                checked={choice === option.value}
                onChange={() => setChoice(option.value)}
              />
              <span className={styles.optionLabel}>{option.label}</span>
            </label>
          ))}
        </fieldset>

        <p className={styles.help}>{selected.help}</p>

        {needsReason ? (
          <label className={styles.field}>
            <span className={styles.label}>Why (for the audit trail)</span>
            <textarea
              className={styles.textarea}
              name="note"
              rows={2}
              required
              maxLength={1000}
              placeholder={
                choice === "paused"
                  ? "e.g. Treatment break, paused at the consultant's request"
                  : "e.g. Twelve week programme completed"
              }
            />
          </label>
        ) : null}

        {state.error ? (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? <p className={styles.success}>{state.success}</p> : null}

        <button className={styles.submit} type="submit" disabled={pending || choice === status}>
          {pending ? "Saving…" : `Set to ${selected.label.toLowerCase()}`}
        </button>
        <p className={styles.caption}>
          Recorded with your name and the time in the audit trail. This is not a sign-in control:
          a paused or discharged client keeps access to their own record and their own data.
        </p>
      </form>
    </section>
  );
}
