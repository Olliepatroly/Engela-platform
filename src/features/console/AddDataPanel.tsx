"use client";

import { useActionState, useState } from "react";
import { recordMetric, addAction, setMetricGoal, type EntryState } from "./entry-actions";
import styles from "./add-data.module.css";

const initial: EntryState = { error: null, success: null };

export type MetricOption = { code: string; name: string; unit: string | null };

/** Local date/time formatted for a datetime-local input's default value. */
function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
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

/**
 * Clinician data entry for the selected client: record a reading after a
 * session or a test (back-dateable, correctable), add an action or safety
 * flag, or adjust this client's goal for a metric. Writes are audited and
 * pillar/composite scores recompute on every change.
 */
export function AddDataPanel({
  clientId,
  reviewId,
  weekNo,
  metricOptions,
}: {
  clientId: string;
  /** The week on screen. Entries attach here, not to whichever week is latest. */
  reviewId: string;
  weekNo: number;
  metricOptions: MetricOption[];
}) {
  const [metricState, metricAction, metricPending] = useActionState(recordMetric, initial);
  const [actionState, actionFormAction, actionPending] = useActionState(addAction, initial);
  const [goalState, goalAction, goalPending] = useActionState(setMetricGoal, initial);
  const [isFlag, setIsFlag] = useState(false);
  const [goalKind, setGoalKind] = useState<"floor" | "ceiling" | "range">("floor");

  return (
    <section className={styles.panel} aria-label="Add data">
      <h2 className={styles.title}>Add data</h2>
      <p className={styles.note}>
        Record a reading after a session or a medical test, add an action for the team, or adjust
        this client&rsquo;s goals. Readings and actions attach to week {weekNo}. Every entry is
        written to the audit trail and the pillar and composite scores recompute automatically.
      </p>

      <div className={styles.grid}>
        <form className={styles.form} action={metricAction}>
          <h3 className={styles.formTitle}>Record a reading</h3>
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="reviewId" value={reviewId} />
          <label className={styles.field}>
            <span className={styles.label}>Metric</span>
            <select className={styles.input} name="metricCode" required defaultValue="">
              <option value="" disabled>
                Choose a metric
              </option>
              {metricOptions.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name}
                  {m.unit ? ` (${m.unit})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Value</span>
            <input
              className={styles.input}
              type="number"
              step="any"
              name="value"
              required
              placeholder="e.g. 56.4"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Date and time</span>
            <input
              className={styles.input}
              type="datetime-local"
              name="recordedAt"
              defaultValue={nowLocal()}
            />
          </label>
          <label className={styles.check}>
            <input type="checkbox" name="correction" />
            <span>This corrects the most recent entry (faulty input)</span>
          </label>
          <Feedback state={metricState} />
          <button className={styles.submit} type="submit" disabled={metricPending}>
            {metricPending ? "Saving…" : "Save reading"}
          </button>
        </form>

        <form className={styles.form} action={actionFormAction}>
          <h3 className={styles.formTitle}>Add an action</h3>
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="reviewId" value={reviewId} />
          <label className={styles.field}>
            <span className={styles.label}>Action</span>
            <textarea
              className={styles.textarea}
              name="text"
              rows={3}
              required
              placeholder="What should happen, and by whom"
            />
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              name="isFlag"
              checked={isFlag}
              onChange={(e) => setIsFlag(e.target.checked)}
            />
            <span>Safety flag for the clinical team</span>
          </label>
          <label className={`${styles.check} ${isFlag ? styles.checkDisabled : ""}`}>
            <input type="checkbox" name="clientVisible" disabled={isFlag} />
            <span>Visible to the client</span>
          </label>
          {isFlag ? (
            <p className={styles.flagNote}>
              Safety flags stay with the clinical team. They are never shown in the client app.
            </p>
          ) : null}
          <Feedback state={actionState} />
          <button className={styles.submit} type="submit" disabled={actionPending}>
            {actionPending ? "Saving…" : "Add action"}
          </button>
        </form>

        <form className={styles.form} action={goalAction}>
          <h3 className={styles.formTitle}>Adjust a goal</h3>
          <p className={styles.formNote}>
            Applies to this client only, based on their health status. The latest reading is
            reassessed against the new goal.
          </p>
          <input type="hidden" name="clientId" value={clientId} />
          <label className={styles.field}>
            <span className={styles.label}>Metric</span>
            <select className={styles.input} name="metricCode" required defaultValue="">
              <option value="" disabled>
                Choose a metric
              </option>
              {metricOptions.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name}
                  {m.unit ? ` (${m.unit})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Goal type</span>
            <select
              className={styles.input}
              name="kind"
              value={goalKind}
              onChange={(e) => setGoalKind(e.target.value as typeof goalKind)}
            >
              <option value="floor">At or above</option>
              <option value="ceiling">At or below</option>
              <option value="range">Between</option>
            </select>
          </label>
          {goalKind === "range" ? (
            <div className={styles.rangeRow}>
              <label className={styles.field}>
                <span className={styles.label}>From</span>
                <input className={styles.input} type="number" step="any" name="min" required />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>To</span>
                <input className={styles.input} type="number" step="any" name="max" required />
              </label>
            </div>
          ) : (
            <label className={styles.field}>
              <span className={styles.label}>Goal value</span>
              <input className={styles.input} type="number" step="any" name="value" required />
            </label>
          )}
          <Feedback state={goalState} />
          <button className={styles.submit} type="submit" disabled={goalPending}>
            {goalPending ? "Saving…" : "Set goal"}
          </button>
        </form>
      </div>
    </section>
  );
}
