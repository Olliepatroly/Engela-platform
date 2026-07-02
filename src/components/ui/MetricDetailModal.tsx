"use client";

import { useEffect } from "react";
import { StatusPill, type PillStatus } from "./StatusPill";
import { MetricDetailChart, type TargetDef } from "./MetricDetailChart";
import styles from "./metric-detail.module.css";

export type MetricDetail = {
  name: string;
  unit: string | null;
  isEstimate: boolean;
  status: PillStatus | null;
  statusLabel?: string;
  currentText: string;
  targetText?: string;
  values: number[];
  target: TargetDef;
  whyItMatters: string | null;
};

/**
 * Enlarged view of one metric: detailed history with the target zone, and why
 * the team tracks it. Used by both surfaces; the caller decides status
 * loudness (the client passes softened labels and never 'flag').
 */
export function MetricDetailModal({
  detail,
  onClose,
}: {
  detail: MetricDetail;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label={`${detail.name} detail`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title}>{detail.name}</h2>
            <div className={styles.chips}>
              {detail.status ? (
                <StatusPill status={detail.status} label={detail.statusLabel} />
              ) : null}
              {detail.isEstimate ? (
                <span className={styles.estimateChip}>estimate, not a lab measure</span>
              ) : null}
            </div>
          </div>
          <button className={styles.close} type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className={styles.valueRow}>
          <span className={styles.currentValue}>{detail.currentText}</span>
          {detail.unit ? <span className={styles.unit}>{detail.unit}</span> : null}
          {detail.targetText ? <span className={styles.target}>{detail.targetText}</span> : null}
        </div>

        <MetricDetailChart values={detail.values} target={detail.target} unit={detail.unit} />

        {detail.whyItMatters ? (
          <section className={styles.why}>
            <h3 className={styles.whyTitle}>Why we track this</h3>
            <p className={styles.whyText}>{detail.whyItMatters}</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
