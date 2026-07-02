"use client";

import { useState } from "react";
import { StatusPill, Sparkline, MetricDetailModal, type MetricDetail } from "@/components/ui";
import type { MetricRowVM } from "./data";
import styles from "./console.module.css";

/**
 * Metric rows for one pillar. Each row opens the drill-down: detailed
 * 12-week history against the target zone, plus why the team tracks it.
 */
export function MetricTable({ label, metrics }: { label: string; metrics: MetricRowVM[] }) {
  const [open, setOpen] = useState<MetricRowVM | null>(null);

  const detail: MetricDetail | null = open
    ? {
        name: open.name,
        unit: open.unit,
        isEstimate: open.isEstimate,
        status: open.status,
        currentText: open.current,
        targetText: open.targetText,
        values: open.history,
        target: open.target,
        whyItMatters: open.whyItMatters,
      }
    : null;

  return (
    <div className={styles.metricTable} role="table" aria-label={`${label} metrics`}>
      {metrics.length === 0 ? (
        <p className={styles.noMetrics}>
          No readings recorded yet. Use Add data below after a session or a test.
        </p>
      ) : null}
      {metrics.map((metric) => (
        <button
          key={metric.code}
          type="button"
          className={styles.metricRow}
          onClick={() => setOpen(metric)}
          aria-label={`Open ${metric.name} detail`}
        >
          <div className={styles.metricName} role="cell">
            <span>{metric.name}</span>
            {metric.isEstimate ? (
              <span className={styles.estimateChip}>estimate, not a lab measure</span>
            ) : null}
            <span className={styles.metricTarget}>
              {metric.targetText}
              {metric.unit ? ` ${metric.unit}` : ""}
            </span>
          </div>
          <div className={styles.metricSpark} role="cell">
            <Sparkline values={metric.history} />
          </div>
          <div className={styles.metricNumbers} role="cell">
            <span className={styles.metricCurrent}>{metric.current}</span>
            <span className={styles.metricPrev}>
              from {metric.previous} · {metric.deltaText}
            </span>
          </div>
          <div className={styles.metricStatus} role="cell">
            {metric.status ? <StatusPill status={metric.status} /> : null}
          </div>
        </button>
      ))}

      {detail ? <MetricDetailModal detail={detail} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
