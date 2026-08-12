"use client";

import { useActionState, useState } from "react";
import { setReportSharing, uploadReport, type ReportState } from "./actions";
import { CLIENT_REPORT_KINDS, REPORT_ACCEPT, REPORT_KIND_LABELS } from "./constants";
import type { ReportVM } from "./data";
import { ReportList } from "./ReportList";
import styles from "./reports.module.css";

const initial: ReportState = { error: null, success: null };

function Feedback({ state }: { state: ReportState }) {
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
 * The client's own documents: results and letters they want on their record,
 * and anything their team has shared with them to read.
 *
 * Sharing is theirs to decide. A document they add is private to them until
 * they choose to share it with their care team, and they can withdraw that at
 * any time. Copy stays warm and second person.
 */
export function ClientReportsPanel({ reports }: { reports: ReportVM[] }) {
  const [state, action, pending] = useActionState(uploadReport, initial);
  const [sharingState, sharingAction] = useActionState(setReportSharing, initial);
  const [fileName, setFileName] = useState<string | null>(null);
  const [share, setShare] = useState(true);

  return (
    <section className={styles.panel} aria-label="Your documents">
      <h2 className={styles.title}>Your documents</h2>
      <p className={styles.note}>
        Add a result or a letter you would like on your record: a test you had done elsewhere, a
        letter from another clinic, anything you think your team should see. You decide whether
        they see it, and you can change your mind later.
      </p>

      <div className={styles.layout}>
        <form className={styles.form} action={action}>
          <h3 className={styles.formTitle}>Add a document</h3>

          <label className={styles.dropzone}>
            <input
              className={styles.fileInput}
              type="file"
              name="file"
              accept={REPORT_ACCEPT}
              required
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
            <span className={styles.dropIcon} aria-hidden="true">
              ⇪
            </span>
            <span className={styles.dropText}>
              {fileName ?? "Choose a PDF or take a photo"}
            </span>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>What is it</span>
            <input
              className={styles.input}
              type="text"
              name="title"
              required
              maxLength={160}
              placeholder="e.g. Blood test from my GP"
            />
          </label>

          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Type</span>
              <select className={styles.input} name="kind" defaultValue="test">
                {CLIENT_REPORT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {REPORT_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Date it is from</span>
              <input className={styles.input} type="date" name="takenOn" />
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Anything you want to add (optional)</span>
            <textarea
              className={styles.textarea}
              name="note"
              rows={2}
              maxLength={2000}
              placeholder="What this is, and anything you would like your team to know"
            />
          </label>

          <label className={styles.check}>
            <input
              type="checkbox"
              name="shareWithTeam"
              checked={share}
              onChange={(e) => setShare(e.target.checked)}
            />
            <span>Share this with my care team</span>
          </label>
          <p className={styles.caption}>
            {share
              ? "Your care team will be able to open this. You can stop sharing it at any time."
              : "Only you will be able to see this until you choose to share it."}
          </p>

          <Feedback state={state} />
          <button className={styles.submit} type="submit" disabled={pending}>
            {pending ? "Saving…" : "Add document"}
          </button>
        </form>

        <div>
          <ReportList
            reports={reports}
            viewer="client"
            sharingAction={sharingAction}
            emptyText="Nothing here yet. Anything you add, or anything your team shares with you, appears here."
          />
          <Feedback state={sharingState} />
        </div>
      </div>
    </section>
  );
}
