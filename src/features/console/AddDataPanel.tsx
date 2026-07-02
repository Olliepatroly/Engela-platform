"use client";

import { useActionState, useState } from "react";
import { recordMetric, addAction, type EntryState } from "./entry-actions";
import styles from "./add-data.module.css";

const initial: EntryState = { error: null, success: null };

export type MetricOption = { code: string; name: string; unit: string | null };

/**
 * Clinician data entry for the selected client: record a reading after a
 * session or a test, or add an action/safety flag. Writes are audited.
 */
export function AddDataPanel({
  clientId,
  metricOptions,
}: {
  clientId: string;
  metricOptions: MetricOption[];
}) {
  const [metricState, metricAction, metricPending] = useActionState(recordMetric, initial);
  const [actionState, actionFormAction, actionPending] = useActionState(addAction, initial);
  const [isFlag, setIsFlag] = useState(false);

  return (
    <section className={styles.panel} aria-label="Add data">
      <h2 className={styles.title}>Add data</h2>
      <p className={styles.note}>
        Record a reading after a session or a medical test, or add an action for the team. Every
        entry is written to the audit trail.
      </p>

      <div className={styles.grid}>
        <form className={styles.form} action={metricAction}>
          <h3 className={styles.formTitle}>Record a reading</h3>
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
          {metricState.error ? (
            <p className={styles.error} role="alert">
              {metricState.error}
            </p>
          ) : null}
          {metricState.success ? <p className={styles.success}>{metricState.success}</p> : null}
          <button className={styles.submit} type="submit" disabled={metricPending}>
            {metricPending ? "Saving…" : "Save reading"}
          </button>
        </form>

        <form className={styles.form} action={actionFormAction}>
          <h3 className={styles.formTitle}>Add an action</h3>
          <input type="hidden" name="clientId" value={clientId} />
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
          {actionState.error ? (
            <p className={styles.error} role="alert">
              {actionState.error}
            </p>
          ) : null}
          {actionState.success ? <p className={styles.success}>{actionState.success}</p> : null}
          <button className={styles.submit} type="submit" disabled={actionPending}>
            {actionPending ? "Saving…" : "Add action"}
          </button>
        </form>
      </div>
    </section>
  );
}
