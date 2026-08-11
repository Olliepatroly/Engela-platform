"use client";

import { useActionState } from "react";
import {
  openReview,
  submitConductedReview,
  setClientStatus,
} from "./review-actions";
import type { EntryState } from "./entry-actions";
import type { ClientSummaryVM } from "./data";
import styles from "./review-setup.module.css";

const initial: EntryState = { error: null, success: null };

/** ISO date of the Monday on or before today, for the week-start default. */
function thisMonday(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function Feedback({ state }: { state: EntryState }) {
  if (state.error) {
    return (
      <p className={styles.error} role="alert">
        {state.error}
      </p>
    );
  }
  if (state.success) return <p className={styles.success}>{state.success}</p>;
  return null;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  discharged: "Discharged",
};

/**
 * Everything a clinical specialist needs to get a client's week underway:
 * conduct the review here, submit one conducted earlier (typically the
 * consultant's PDF), or set whether the account is active.
 *
 * Any clinical role may conduct or submit a review, because that is the whole
 * team's work. Sign-off stays the consultant's act, in the sign-off panel.
 */
export function ReviewSetupPanel({
  client,
  defaultOpen,
}: {
  client: ClientSummaryVM;
  /** Open by default when there is no review yet; a summary otherwise. */
  defaultOpen: boolean;
}) {
  const [openState, openAction, openPending] = useActionState(openReview, initial);
  const [submitState, submitAction, submitPending] = useActionState(
    submitConductedReview,
    initial,
  );
  const [statusState, statusAction, statusPending] = useActionState(setClientStatus, initial);

  const statusLabel = STATUS_LABELS[client.status] ?? client.status;
  const statusClass =
    client.status === "active"
      ? styles.statusActive
      : client.status === "paused"
        ? styles.statusPaused
        : styles.statusDischarged;

  return (
    <section className={styles.panel} aria-label="Reviews">
      <div className={styles.head}>
        <h2 className={styles.title}>{defaultOpen ? "Start this client" : "Review admin"}</h2>
        <span className={`${styles.statusChip} ${statusClass}`}>
          <span className={styles.statusDot} aria-hidden="true" />
          {statusLabel}
        </span>
      </div>
      <p className={styles.note}>
        {defaultOpen
          ? "This client has no weekly review yet, so there is nothing for readings, actions or sign-off to attach to. Open week " +
            client.suggestedWeekNo +
            " to begin, or submit a review the team conducted earlier."
          : "Open the next week when this one is finished, or submit a review the team conducted away from the console."}
      </p>

      {client.parqCompletedAt ? (
        <p className={client.parqPositive ? styles.parqPositive : styles.parqDone}>
          <span className={styles.parqDot} aria-hidden="true" />
          {client.parqPositive
            ? "Readiness screening (PAR-Q) completed with at least one yes. Review the answers before the next session."
            : "Readiness screening (PAR-Q) completed, no yes answers."}
        </p>
      ) : (
        <p className={styles.parqPending}>
          <span className={styles.parqDot} aria-hidden="true" />
          Readiness screening (PAR-Q) not completed yet.
        </p>
      )}

      <details className={styles.details} open={defaultOpen}>
        <summary className={styles.summary}>Open a review, or submit one conducted earlier</summary>

        <div className={styles.grid}>
          <form className={styles.form} action={openAction}>
            <h3 className={styles.formTitle}>Conduct a review here</h3>
            <p className={styles.formNote}>
              Opens the week so the team can record readings, add actions and set goals against it.
            </p>
            <input type="hidden" name="clientId" value={client.clientId} />
            <label className={styles.field}>
              <span className={styles.label}>Programme week</span>
              <input
                className={styles.input}
                type="number"
                name="weekNo"
                min={1}
                step={1}
                defaultValue={client.suggestedWeekNo}
                required
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Week starting</span>
              <input
                className={styles.input}
                type="date"
                name="windowStart"
                defaultValue={thisMonday()}
              />
            </label>
            <p className={styles.formNote}>
              The window runs Monday to Sunday from the date you choose.
            </p>
            <Feedback state={openState} />
            <button className={styles.submit} type="submit" disabled={openPending}>
              {openPending ? "Opening…" : "Open the review"}
            </button>
          </form>

          <form className={styles.form} action={submitAction}>
            <h3 className={styles.formTitle}>Submit a review conducted earlier</h3>
            <p className={styles.formNote}>
              For a review the team already did, in clinic or on a call. Attach the consultant&rsquo;s
              PDF if there is one.
            </p>
            <input type="hidden" name="clientId" value={client.clientId} />
            <label className={styles.field}>
              <span className={styles.label}>Programme week</span>
              <input
                className={styles.input}
                type="number"
                name="weekNo"
                min={1}
                step={1}
                defaultValue={client.suggestedWeekNo}
                required
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Conducted on</span>
              <input
                className={styles.input}
                type="date"
                name="conductedOn"
                max={today()}
                defaultValue={today()}
                required
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Conducted by</span>
              <input
                className={styles.input}
                type="text"
                name="conductedByName"
                placeholder="Name of the clinician who did it"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Clinical summary</span>
              <textarea
                className={styles.textarea}
                name="summary"
                rows={4}
                required
                minLength={20}
                placeholder="What the review found and what happens next"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Report PDF (optional)</span>
              <input
                className={styles.file}
                type="file"
                name="report"
                accept="application/pdf"
              />
            </label>
            <p className={styles.formNote}>
              The summary and any document stay with the clinical team. They are never shown in the
              client app.
            </p>
            <Feedback state={submitState} />
            <button className={styles.submit} type="submit" disabled={submitPending}>
              {submitPending ? "Saving…" : "Submit the review"}
            </button>
          </form>

          <form className={styles.form} action={statusAction}>
            <h3 className={styles.formTitle}>Account</h3>
            <p className={styles.formNote}>
              Activating turns the client app on for this person. Pausing shows them a calm
              &ldquo;your programme is paused&rdquo; message, not an empty screen.
            </p>
            <input type="hidden" name="clientId" value={client.clientId} />
            <p className={styles.statusLine}>
              Currently <strong>{statusLabel.toLowerCase()}</strong>.
            </p>
            <div className={styles.statusButtons}>
              <button
                className={styles.submit}
                type="submit"
                name="status"
                value="active"
                disabled={statusPending || client.status === "active"}
              >
                Activate
              </button>
              <button
                className={styles.secondary}
                type="submit"
                name="status"
                value="paused"
                disabled={statusPending || client.status === "paused"}
              >
                Pause
              </button>
              <button
                className={styles.secondary}
                type="submit"
                name="status"
                value="discharged"
                disabled={statusPending || client.status === "discharged"}
              >
                Discharge
              </button>
            </div>
            <Feedback state={statusState} />
          </form>
        </div>
      </details>
    </section>
  );
}
