"use client";

import { useState } from "react";
import styles from "./reports.module.css";

/**
 * Foundation for PDF report upload (lab reports, DEXA scans, clinic letters).
 * Deliberately non-functional for now: no file leaves the browser. Secure
 * storage, parsing and data extraction arrive in a later phase.
 */
export function ReportsPanel() {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <section className={styles.panel} aria-label="Reports">
      <h2 className={styles.title}>Reports</h2>
      <p className={styles.note}>
        Upload a PDF report (bloods, DEXA, clinic letter) to read alongside the review and pull
        values into the record.
      </p>
      <label className={styles.dropzone}>
        <input
          className={styles.fileInput}
          type="file"
          accept="application/pdf"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
        <span className={styles.dropIcon} aria-hidden="true">
          ⇪
        </span>
        <span className={styles.dropText}>
          {fileName ? fileName : "Choose a PDF report"}
        </span>
      </label>
      {fileName ? (
        <p className={styles.pending}>
          Report selected. Secure upload and data extraction arrive in a later phase; nothing has
          left this device.
        </p>
      ) : (
        <p className={styles.caption}>PDF only. Secure storage and extraction arrive in a later phase.</p>
      )}
    </section>
  );
}
