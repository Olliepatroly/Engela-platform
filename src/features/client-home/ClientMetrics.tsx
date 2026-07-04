"use client";

import { useState } from "react";
import { StatusPill, MetricDetailModal, type MetricDetail } from "@/components/ui";
import type { ClientHomeVM } from "./data";
import styles from "./client-home.module.css";

type ClientMetric = ClientHomeVM["metrics"][number];

/* Client loudness: same status logic as the console, gentler words, never red. */
const CLIENT_STATUS_LABELS: Record<string, string> = {
  on_track: "On track",
  watch: "Worth watching",
  focus: "This week's focus",
};

function minutesToHhMm(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function formatMetricValue(code: string, value: number | null): string {
  if (value == null) return "–";
  if (code === "active_time") return minutesToHhMm(value);
  return String(value);
}

/**
 * The client's numbers, each opening a drill-down with the detailed trend,
 * target zone and why it matters. Softened statuses only; never red.
 */
export function ClientMetrics({ metrics }: { metrics: ClientMetric[] }) {
  const [open, setOpen] = useState<ClientMetric | null>(null);

  const detail: MetricDetail | null = open
    ? {
        name: open.label,
        unit: open.unit,
        isEstimate: open.is_estimate,
        status: open.status,
        statusLabel: open.status ? CLIENT_STATUS_LABELS[open.status] : undefined,
        currentText: formatMetricValue(open.code, open.current),
        values: Array.isArray(open.history) ? open.history : [],
        target: open.target_def,
        whyItMatters: open.why_it_matters,
      }
    : null;

  return (
    <>
      <ul className={styles.metricList}>
        {metrics.map((metric) => (
          <li key={metric.code}>
            <button
              type="button"
              className={styles.metricCard}
              onClick={() => setOpen(metric)}
              aria-label={`Open ${metric.label} detail`}
            >
              <div className={styles.metricTop}>
                <span className={styles.metricLabel}>{metric.label}</span>
                {metric.status ? (
                  <StatusPill status={metric.status} label={CLIENT_STATUS_LABELS[metric.status]} />
                ) : null}
              </div>
              {metric.current == null ? (
                <span className={styles.notMeasured}>Not measured yet</span>
              ) : (
                <span className={styles.metricValue}>
                  {formatMetricValue(metric.code, metric.current)}
                  {metric.unit && metric.code !== "active_time" ? (
                    <span className={styles.metricUnit}> {metric.unit}</span>
                  ) : null}
                </span>
              )}
              {metric.is_estimate ? (
                <span className={styles.estimateNote}>
                  An estimate from your wearable, not a lab measure.
                </span>
              ) : null}
              <span className={styles.metricMore}>
                {metric.current == null ? "Why this matters" : "See your trend"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {detail ? <MetricDetailModal detail={detail} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
