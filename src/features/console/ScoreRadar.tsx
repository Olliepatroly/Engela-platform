"use client";

import { useState } from "react";
import {
  RadarChart,
  MetricDetailModal,
  type MetricDetail,
  type RadarAxis,
  type RadarSeries,
} from "@/components/ui";
import type { PillarSectionVM } from "./data";
import styles from "./console.module.css";

/**
 * The weekly review's headline spider graph. Every metric across the three
 * pillars sits on one 0-to-10 axis (the shared metric sub-score, so kg, bpm and
 * hours are comparable), with baseline, current and target rings overlaid. The
 * composite score reads in the centre. Clicking a point (or its label) opens
 * that metric's history, the same drill-down the metric table uses.
 */
export function ScoreRadar({
  pillars,
  composite,
  heading = "Outcome radar",
  note = "Every metric on one 0 to 10 score. Select a point to open its history.",
  footer,
}: {
  pillars: PillarSectionVM[];
  composite: number | null;
  heading?: string;
  note?: string;
  /** Optional trailing content, e.g. a link to the full weekly review. */
  footer?: React.ReactNode;
}) {
  const [open, setOpen] = useState<MetricDetail | null>(null);

  // Flatten in pillar order (exercise, nutrition, immune); keep the pillar as
  // the group so the radar can band them.
  const rows = pillars.flatMap((p) => p.metrics.map((m) => ({ metric: m, group: p.label })));

  // A radar needs at least three axes to be more than a line. Below that, keep
  // the panel but explain that it fills in once there are enough readings.
  if (rows.length < 3) {
    return (
      <section className={styles.radarPanel} aria-label={heading}>
        <div className={styles.radarHead}>
          <h2 className={styles.radarTitle}>{heading}</h2>
          <p className={styles.radarNote}>{note}</p>
        </div>
        <p className={styles.radarEmpty}>
          Not enough readings yet for the outcome radar. It appears once at least three metrics have
          data.
        </p>
        {footer ? <div className={styles.radarFooter}>{footer}</div> : null}
      </section>
    );
  }

  const axes: RadarAxis[] = rows.map(({ metric, group }) => ({
    key: metric.code,
    label: metric.name,
    group,
  }));

  const series: RadarSeries[] = [
    {
      key: "baseline",
      label: "Baseline",
      variant: "baseline",
      values: rows.map(({ metric }) => metric.baselineScore),
    },
    {
      key: "current",
      label: "Current",
      variant: "current",
      values: rows.map(({ metric }) => metric.currentScore),
    },
  ];

  const openMetric = (index: number) => {
    const row = rows[index];
    if (!row) return;
    const { metric } = row;
    setOpen({
      name: metric.name,
      unit: metric.unit,
      isEstimate: metric.isEstimate,
      status: metric.status,
      currentText: metric.current,
      targetText: metric.targetText,
      values: metric.history,
      target: metric.target,
      whyItMatters: metric.whyItMatters,
    });
  };

  return (
    <section className={styles.radarPanel} aria-label={heading}>
      <div className={styles.radarHead}>
        <h2 className={styles.radarTitle}>{heading}</h2>
        <p className={styles.radarNote}>{note}</p>
      </div>

      <RadarChart
        axes={axes}
        series={series}
        max={10}
        onAxisActivate={openMetric}
        centerValue={composite != null ? composite.toFixed(1) : "–"}
        centerLabel="Composite"
        ariaLabel="Outcome radar: each metric scored 0 to 10, with baseline and current against the target and needs-attention zones"
      />

      {footer ? <div className={styles.radarFooter}>{footer}</div> : null}

      {open ? <MetricDetailModal detail={open} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}
