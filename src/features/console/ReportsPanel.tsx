"use client";

import { useActionState, useState } from "react";
import { uploadReport } from "./review-actions";
import type { EntryState } from "./entry-actions";
import type { ReportVM } from "./data";
import styles from "./reports.module.css";

const initial: EntryState = { error: null, success: null };

const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "consultant_review", label: "Consultant review" },
  { value: "bloods", label: "Bloods" },
  { value: "dexa", label: "DEXA scan" },
  { value: "clinic_letter", label: "Clinic letter" },
  { value: "other", label: "Other document" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Clinical reports for the selected client: file a PDF (a consultant's review
 * written up elsewhere, bloods, a DEXA scan, a clinic letter) and open the
 * ones already held. Documents go to a private bucket and are opened through
 * short-lived signed links.
 *
 * Clinical team only. These carry raw labs and disease markers, so they are
 * never reachable from the client app (safety rule 2).
 */
export function ReportsPanel({
  clientId,
  reviewId,
  weekNo,
  reports,
}: {
  clientId: string;
  /** The week on screen, so an upload can be tied to it. Null before any review. */
  reviewId: string | null;
  weekNo: number | null;
  reports: ReportVM[];
}) {
  const [state, action, pending] = useActionState(uploadReport, initial);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <section className={styles.panel} aria-label="Reports">
      <h2 className={styles.title}>Reports</h2>
      <p className={styles.note}>
        File a PDF report (a review conducted elsewhere, bloods, a DEXA scan, a clinic letter) to
        keep alongside the record. Stored privately for the care team and opened through a link
        that expires after an hour.
      </p>

      <form className={styles.form} action={action}>
        <input type="hidden" name="clientId" value={clientId} />
        {reviewId ? <input type="hidden" name="reviewId" value={reviewId} /> : null}

        <label className={styles.dropzone}>
          <input
            className={styles.fileInput}
            type="file"
            name="report"
            accept="application/pdf"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
          <span className={styles.dropIcon} aria-hidden="true">
            ⇪
          </span>
          <span className={styles.dropText}>{fileName ?? "Choose a PDF report"}</span>
        </label>

        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span className={styles.label}>Title</span>
            <input
              className={styles.input}
              type="text"
              name="title"
              required
              minLength={3}
              placeholder="e.g. Week 32 consultant review"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Type</span>
            <select className={styles.input} name="kind" defaultValue="consultant_review">
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span className={styles.label}>Conducted on</span>
            <input className={styles.input} type="date" name="conductedOn" />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Conducted by</span>
            <input
              className={styles.input}
              type="text"
              name="conductedByName"
              placeholder="Name of the clinician"
            />
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Note (optional)</span>
          <input
            className={styles.input}
            type="text"
            name="note"
            placeholder="Anything the team should know before opening it"
          />
        </label>

        {state.error ? (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? <p className={styles.success}>{state.success}</p> : null}

        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? "Uploading…" : "File the report"}
        </button>
        <p className={styles.caption}>
          PDF only, up to 10 MB.{" "}
          {reviewId && weekNo != null
            ? `This will be filed against week ${weekNo}.`
            : "It will be held against the client until a review is open."}{" "}
          Clinical team only, never shown in the client app.
        </p>
      </form>

      <h3 className={styles.listTitle}>
        {reports.length === 0 ? "No reports yet" : `Reports on file (${reports.length})`}
      </h3>
      {reports.length === 0 ? (
        <p className={styles.caption}>Anything the team files will be listed here, newest first.</p>
      ) : (
        <ul className={styles.list}>
          {reports.map((report) => (
            <li key={report.id} className={styles.item}>
              <div className={styles.itemHead}>
                <span className={styles.kindChip}>{report.kindLabel}</span>
                {report.weekNo != null ? (
                  <span className={styles.weekChip}>Week {report.weekNo}</span>
                ) : null}
              </div>
              <p className={styles.itemTitle}>
                {report.url ? (
                  <a
                    className={styles.itemLink}
                    href={report.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {report.title}
                  </a>
                ) : (
                  report.title
                )}
              </p>
              <p className={styles.itemMeta}>
                {report.conductedOn ? `Conducted ${formatDate(report.conductedOn)}` : "Undated"}
                {report.authorName ? ` by ${report.authorName}` : ""} · Filed{" "}
                {formatDate(report.createdAt)} by {report.uploadedByName}
              </p>
              {report.note ? <p className={styles.itemNote}>{report.note}</p> : null}
              {report.url ? null : (
                <p className={styles.itemMissing}>
                  This document could not be opened. Ask the person who filed it to upload it again.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
