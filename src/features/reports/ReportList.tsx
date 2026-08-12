"use client";

import type { ReportVM } from "./data";
import styles from "./reports.module.css";

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Reports on a record, newest first. The sharing control differs by surface:
 * a clinician turns sharing with the client on or off for clinical documents;
 * a client turns sharing with their care team on or off for their own. Neither
 * can change the other's choice, and the server enforces that too.
 *
 * Sharing state is never colour alone: each report carries a worded chip.
 */
export function ReportList({
  reports,
  viewer,
  sharingAction,
  emptyText,
}: {
  reports: ReportVM[];
  viewer: "clinician" | "client";
  sharingAction: (formData: FormData) => void;
  emptyText: string;
}) {
  if (reports.length === 0) return <p className={styles.empty}>{emptyText}</p>;

  return (
    <ul className={styles.list}>
      {reports.map((report) => {
        const ownUpload = viewer === "client" && report.submittedRole === "client";
        const canChangeSharing = viewer === "clinician" || ownUpload;
        const shareOn = viewer === "clinician" ? report.visibleToClient : report.sharedWithTeam;
        const nextShare = viewer === "clinician"
          ? shareOn
            ? "client-off"
            : "client-on"
          : shareOn
            ? "team-off"
            : "team-on";

        return (
          <li key={report.id} className={styles.item}>
            <div className={styles.itemHead}>
              <span className={styles.itemTitle}>{report.title}</span>
              <span className={styles.itemMeta}>
                {report.isPdf ? "PDF" : "Photo"} · {report.sizeText}
              </span>
            </div>

            <div className={styles.tags}>
              <span className={`${styles.chip} ${styles.chipKind}`}>{report.kindLabel}</span>
              {report.weekNo != null ? (
                <span className={`${styles.chip} ${styles.chipKind}`}>Week {report.weekNo}</span>
              ) : null}
              <span
                className={`${styles.chip} ${shareOn ? styles.chipShared : styles.chipPrivate}`}
              >
                {viewer === "clinician"
                  ? shareOn
                    ? "Shared with the client"
                    : "Clinical team only"
                  : shareOn
                    ? "Shared with your care team"
                    : "Only you can see it"}
              </span>
            </div>

            <p className={styles.itemMeta}>
              {report.takenOn ? `From ${formatDate(report.takenOn)}. ` : ""}
              {ownUpload
                ? "Added by you"
                : `Submitted by ${report.submittedByName}${
                    viewer === "clinician" && report.submittedRole === "client"
                      ? " (the client)"
                      : ""
                  }`}{" "}
              on {formatDate(report.submittedAt)}.
            </p>

            {report.note ? <p className={styles.itemNote}>{report.note}</p> : null}

            <div className={styles.actions}>
              {report.fileUrl ? (
                <a
                  className={styles.openLink}
                  href={report.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>
              ) : (
                <span className={styles.itemMeta}>File unavailable.</span>
              )}

              {canChangeSharing ? (
                <form action={sharingAction}>
                  <input type="hidden" name="reportId" value={report.id} />
                  <input type="hidden" name="share" value={nextShare} />
                  {/* Sharing a clinical document with the client carries the
                      same confirmation as the upload form: the client app
                      never shows raw results. */}
                  {viewer === "clinician" && !shareOn ? (
                    <label className={styles.check}>
                      <input type="checkbox" name="clientSafeConfirmed" required />
                      <span>
                        No raw lab values, disease markers or MRD results in this document.
                      </span>
                    </label>
                  ) : null}
                  <button className={styles.shareButton} type="submit">
                    {viewer === "clinician"
                      ? shareOn
                        ? "Stop sharing with the client"
                        : "Share with the client"
                      : shareOn
                        ? "Stop sharing with my team"
                        : "Share with my team"}
                  </button>
                </form>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
