"use client";

import { useState } from "react";
import { ClientMetrics } from "./ClientMetrics";
import type { ClientHomeVM } from "./data";
import styles from "./client-home.module.css";

/* Client-facing pillar names (not the console's Exercise/Immune). */
const PILLAR_LABELS: Record<string, string> = {
  exercise: "Movement",
  nutrition: "Nutrition",
  immune: "Recovery and immunity",
};

type Pillar = ClientHomeVM["pillars"][number];
type Metric = ClientHomeVM["metrics"][number];

/**
 * The three pillars as an accordion. Collapsed, each shows its name, score and
 * how far it has come. Expanded, it reveals that pillar's own metrics (grouped
 * client-side from home.metrics by their `pillar`) with the estimate caveat and
 * colour + dot + text status carried through unchanged. Default all collapsed;
 * multiple may be open at once. No new data — a pure regroup of the same
 * client-safe projection.
 */
export function ClientPillars({ pillars, metrics }: { pillars: Pillar[]; metrics: Metric[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className={styles.pillars} aria-label="Your three pillars">
      {pillars.map((pillar) => {
        const key = pillar.pillar;
        const isOpen = open.has(key);
        const panelId = `pillar-panel-${key}`;
        const pillarMetrics = metrics.filter((m) => m.pillar === key);

        return (
          <div key={key} className={styles.pillarItem}>
            <button
              type="button"
              className={styles.pillarHeader}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggle(key)}
            >
              <span className={styles.pillarScore}>{pillar.score.toFixed(1)}</span>
              <span className={styles.pillarHeaderText}>
                <span className={styles.pillarLabel}>{PILLAR_LABELS[key]}</span>
                {pillar.baseline != null ? (
                  <span className={styles.pillarBaseline}>
                    up from {pillar.baseline.toFixed(1)} when you started
                  </span>
                ) : null}
              </span>
              <svg
                className={styles.chevron}
                data-open={isOpen ? "true" : undefined}
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isOpen ? (
              <div id={panelId} className={styles.pillarPanel}>
                {pillarMetrics.length > 0 ? (
                  <ClientMetrics metrics={pillarMetrics} />
                ) : (
                  <p className={styles.pillarEmpty}>
                    Nothing measured for this pillar yet. Your team will add measures as your
                    programme goes on.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
