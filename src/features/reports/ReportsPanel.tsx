"use client";

import { useActionState, useState } from "react";
import { setReportSharing, uploadReport, type ReportState } from "./actions";
import { REPORT_ACCEPT, REPORT_KINDS, REPORT_KIND_LABELS } from "./constants";
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

/** Today in the browser's own timezone, for a date input's default value. */
function todayLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/**
 * Console reports: submit a report or test result for the selected client and
 * read what is already on their record.
 *
 * Anyone on the care team can submit one, including a PDF of a review a
 * consultant conducted in clinic (attach it to the open week so it sits with
 * that review). A clinical document stays with the clinical team unless the
 * uploader explicitly shares it with the client and confirms it carries no raw
 * lab values, disease markers or MRD results, which the client app never shows.
 */
export function ReportsPanel({
  clientId,
  reviewId,
  weekNo,
  reports,
}: {
  clientId: string;
  reviewId: string | null;
  weekNo: number | null;
  reports: ReportVM[];
}) {
  const [state, action, pending] = useActionState(uploadReport, initial);
  const [sharingState, sharingAction] = useActionState(setReportSharing, initial);
  const [fileName, setFileName] = useState<string | null>(null);
  const [shareWithClient, setShareWithClient] = useState(false);
  const [attachToWeek, setAttachToWeek] = useState(reviewId != null);

  return (
    <section className={styles.panel} aria-label="Reports">
      <h2 className={styles.title}>Reports and test results</h2>
      <p className={styles.note}>
        Submit a report the team produced (a consultant&rsquo;s review PDF, bloods, a DEXA scan, a
        clinic letter) or a result the client brought in. Anyone on the care team can submit one.
        Every submission is written to the audit trail.
      </p>

      <div className={styles.layout}>
        <form className={styles.form} action={action}>
          <h3 className={styles.formTitle}>Submit a report</h3>
          <input type="hidden" name="clientId" value={clientId} />
          {reviewId && attachToWeek ? (
            <input type="hidden" name="reviewId" value={reviewId} />
          ) : null}

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
            <span className={styles.dropText}>{fileName ?? "Choose a PDF or a photo"}</span>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Title</span>
            <input
              className={styles.input}
              type="text"
              name="title"
              required
              maxLength={160}
              placeholder="e.g. Consultant review, 4 August"
            />
          </label>

          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Type</span>
              <select className={styles.input} name="kind" defaultValue="review">
                {REPORT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {REPORT_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Date it is from</span>
              <input
                className={styles.input}
                type="date"
                name="takenOn"
                defaultValue={todayLocal()}
              />
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Note for the team (optional)</span>
            <textarea
              className={styles.textarea}
              name="note"
              rows={2}
              maxLength={2000}
              placeholder="What the team should take from this"
            />
          </label>

          {reviewId ? (
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={attachToWeek}
                onChange={(e) => setAttachToWeek(e.target.checked)}
              />
              <span>Attach to week {weekNo} so it sits with that review</span>
            </label>
          ) : null}

          <label className={styles.check}>
            <input
              type="checkbox"
              name="shareWithClient"
              checked={shareWithClient}
              onChange={(e) => setShareWithClient(e.target.checked)}
            />
            <span>Share this document with the client in their app</span>
          </label>

          {shareWithClient ? (
            <>
              <label className={styles.check}>
                <input type="checkbox" name="clientSafeConfirmed" required />
                <span>
                  I confirm this document holds no raw lab values, disease markers or MRD results.
                </span>
              </label>
              <p className={styles.consentNote}>
                The client app never shows raw results. Share a document only when it is written for
                the client to read on their own.
              </p>
            </>
          ) : (
            <p className={styles.caption}>
              Not shared: only the client&rsquo;s consented care team can open it.
            </p>
          )}

          <Feedback state={state} />
          <button className={styles.submit} type="submit" disabled={pending}>
            {pending ? "Submitting…" : "Submit report"}
          </button>
        </form>

        <div>
          <ReportList
            reports={reports}
            viewer="clinician"
            sharingAction={sharingAction}
            emptyText="No reports on this record yet."
          />
          <Feedback state={sharingState} />
        </div>
      </div>
    </section>
  );
}
