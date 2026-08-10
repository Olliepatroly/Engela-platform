"use client";

import { useId } from "react";
import styles from "./radar.module.css";

export type RadarAxis = {
  /** Stable key (e.g. metric code). */
  key: string;
  /** Axis label drawn around the perimeter. */
  label: string;
  /** Optional grouping (e.g. pillar) — draws faint alternating bands. */
  group?: string;
};

export type RadarSeriesVariant = "baseline" | "current" | "target";

export type RadarSeries = {
  key: string;
  label: string;
  variant: RadarSeriesVariant;
  /** One value per axis, same order as `axes`. Null renders as the centre. */
  values: (number | null)[];
};

const VARIANT_STYLE: Record<
  RadarSeriesVariant,
  { stroke: string; fill: string; fillOpacity: number; dash: string; width: number }
> = {
  baseline: { stroke: "var(--c-slate)", fill: "none", fillOpacity: 0, dash: "none", width: 2 },
  current: {
    stroke: "var(--c-amber)",
    fill: "var(--c-amber)",
    fillOpacity: 0.18,
    dash: "none",
    width: 2.75,
  },
  target: {
    stroke: "var(--c-text-tertiary)",
    fill: "none",
    fillOpacity: 0,
    dash: "5 4",
    width: 1.5,
  },
};

const W = 880;
const H = 680;
const CX = W / 2;
const CY = H / 2;
const R = 205;

/** Round to 2dp: Math.sin/cos differ by ~1 ULP across JS engines, so raw
 *  coordinates hydrate mismatched between the server and the browser. */
const q = (n: number): number => Math.round(n * 100) / 100;

function pointAt(index: number, count: number, radius: number): { x: number; y: number } {
  const angle = (-90 + (index * 360) / count) * (Math.PI / 180);
  return { x: q(CX + radius * Math.cos(angle)), y: q(CY + radius * Math.sin(angle)) };
}

/** Closed n-gon path at a given radius. */
function ngonPath(count: number, radius: number): string {
  return (
    Array.from({ length: count }, (_, i) => {
      const { x, y } = pointAt(i, count, radius);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    }).join(" ") + " Z"
  );
}

/** Greedy wrap so long axis labels sit on up to two short lines. */
function wrapLabel(label: string): string[] {
  const words = label.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > 12 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function polygonPath(values: (number | null)[], count: number, max: number): string {
  return (
    values
      .map((v, i) => {
        const radius = ((v ?? 0) / max) * R;
        const { x, y } = pointAt(i, count, radius);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ") + " Z"
  );
}

/**
 * Reusable spider / radar chart. Pure SVG (no charting library, per the house
 * style). Behind the series it shades two zones on the shared score scale: a
 * target band to aim into and a low "needs attention" band. Each series is a
 * polygon; the `current` series carries clickable points and every axis is a
 * clickable, keyboard-focusable chip so a caller can open that axis's history.
 * Colour is never the only signal, every zone and series is named in the legend
 * and each chip exposes its value in an aria-label.
 */
export function RadarChart({
  axes,
  series,
  max = 10,
  rings = 5,
  onAxisActivate,
  centerValue,
  centerLabel,
  ariaLabel,
  redZoneMax = 4,
  targetZoneMin = 8,
  targetZoneLabel = "Target zone",
  redZoneLabel = "Needs attention",
}: {
  axes: RadarAxis[];
  series: RadarSeries[];
  max?: number;
  rings?: number;
  onAxisActivate?: (index: number) => void;
  centerValue?: string;
  centerLabel?: string;
  ariaLabel?: string;
  /** Scores at or below this sit in the red "needs attention" band. */
  redZoneMax?: number;
  /** Scores at or above this sit in the target band clients aim into. */
  targetZoneMin?: number;
  targetZoneLabel?: string;
  redZoneLabel?: string;
}) {
  const uid = useId();
  const n = axes.length;
  if (n < 3) return null;

  // Contiguous group bands (e.g. one per pillar), alternating a faint wash.
  const bands: { start: number; end: number; index: number }[] = [];
  let bandIndex = -1;
  axes.forEach((axis, i) => {
    const prev = i > 0 ? axes[i - 1]?.group : undefined;
    if (i === 0 || axis.group !== prev) {
      bandIndex += 1;
      bands.push({ start: i, end: i, index: bandIndex });
    } else {
      const band = bands[bands.length - 1];
      if (band) band.end = i;
    }
  });

  const ringLevels = Array.from({ length: rings }, (_, k) => k + 1);
  const orderedSeries = (["baseline", "current"] as RadarSeriesVariant[])
    .map((v) => series.find((s) => s.variant === v))
    .filter((s): s is RadarSeries => Boolean(s));

  return (
    <figure className={styles.figure} role="group" aria-label={ariaLabel ?? "Score radar"}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.svg}
        role="img"
        aria-label={ariaLabel ?? "Score radar"}
      >
        {/* Zones — drawn first, behind everything. Target band clients aim into,
            and the low band that needs attention. */}
        <path
          d={`${ngonPath(n, R)} ${ngonPath(n, (targetZoneMin / max) * R)}`}
          fillRule="evenodd"
          className={styles.targetZone}
        />
        <path d={ngonPath(n, (redZoneMax / max) * R)} className={styles.redZone} />

        {/* Group bands — faint alternating wedges to read pillars at a glance. */}
        {bands.map((band) =>
          band.index % 2 === 0 ? (
            <path
              key={`band-${band.index}`}
              d={(() => {
                const a0 = band.start - 0.5;
                const a1 = band.end + 0.5;
                const p0 = pointAt(a0, n, R);
                const p1 = pointAt(a1, n, R);
                const large = a1 - a0 > n / 2 ? 1 : 0;
                return `M ${CX} ${CY} L ${p0.x} ${p0.y} A ${R} ${R} 0 ${large} 1 ${p1.x} ${p1.y} Z`;
              })()}
              className={styles.band}
            />
          ) : null,
        )}

        {/* Concentric rings. */}
        {ringLevels.map((k) => (
          <path key={`ring-${k}`} d={ngonPath(n, (R * k) / rings)} className={styles.ring} />
        ))}

        {/* Spokes + ring value labels along the top spoke. */}
        {axes.map((_, i) => {
          const { x, y } = pointAt(i, n, R);
          return (
            <line key={`spoke-${i}`} x1={CX} y1={CY} x2={x} y2={y} className={styles.spoke} />
          );
        })}
        {ringLevels.map((k) => (
          <text
            key={`rv-${k}`}
            x={CX + 5}
            y={CY - (R * k) / rings + 4}
            className={styles.ringValue}
          >
            {Math.round((max * k) / rings)}
          </text>
        ))}

        {/* Series polygons: baseline line, then the current fill on top. */}
        {orderedSeries.map((s) => {
          const st = VARIANT_STYLE[s.variant];
          return (
            <path
              key={`series-${s.key}`}
              d={polygonPath(s.values, n, max)}
              fill={st.fill}
              fillOpacity={st.fillOpacity}
              stroke={st.stroke}
              strokeWidth={st.width}
              strokeLinejoin="round"
            />
          );
        })}

        {/* Zone boundaries drawn over the fills so both zones stay legible even
            under the current polygon. */}
        <path
          d={ngonPath(n, (targetZoneMin / max) * R)}
          className={styles.targetBoundary}
        />
        <path d={ngonPath(n, (redZoneMax / max) * R)} className={styles.redBoundary} />

        {/* Clickable points on the current series (mouse; chips carry keyboard). */}
        {(() => {
          const current = series.find((s) => s.variant === "current");
          if (!current) return null;
          return current.values.map((v, i) => {
            if (v == null) return null;
            const radius = (v / max) * R;
            const { x, y } = pointAt(i, n, radius);
            return (
              <g
                key={`pt-${axes[i]?.key ?? i}`}
                className={onAxisActivate ? styles.point : undefined}
                onClick={onAxisActivate ? () => onAxisActivate(i) : undefined}
                aria-hidden="true"
              >
                <circle cx={x} cy={y} r={16} className={styles.hit} />
                <circle cx={x} cy={y} r={5} className={styles.dot} />
              </g>
            );
          });
        })()}

        {/* Axis labels as clickable chips (the keyboard-focusable control). */}
        {axes.map((axis, i) => {
          const base = pointAt(i, n, R + 14);
          const cos = Math.cos((-90 + (i * 360) / n) * (Math.PI / 180));
          const lines = wrapLabel(axis.label);
          const maxChars = Math.max(...lines.map((l) => l.length));
          const w = Math.ceil(maxChars * 6.7) + 16;
          const h = lines.length * 13 + 8;
          let rectX: number;
          let textX: number;
          let anchor: "start" | "middle" | "end";
          if (cos > 0.2) {
            rectX = base.x;
            textX = base.x + 8;
            anchor = "start";
          } else if (cos < -0.2) {
            rectX = base.x - w;
            textX = base.x - 8;
            anchor = "end";
          } else {
            rectX = q(base.x - w / 2);
            textX = base.x;
            anchor = "middle";
          }
          const rectY = q(base.y - h / 2);
          const value = series.find((s) => s.variant === "current")?.values[i];
          const activate = onAxisActivate;
          return (
            <g
              key={`chip-${axis.key}`}
              className={activate ? styles.chip : undefined}
              role={activate ? "button" : undefined}
              tabIndex={activate ? 0 : undefined}
              aria-label={
                activate
                  ? `${axis.label}${value != null ? `, score ${value.toFixed(1)} out of ${max}` : ""}. Open history.`
                  : undefined
              }
              onClick={activate ? () => activate(i) : undefined}
              onKeyDown={
                activate
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        activate(i);
                      }
                    }
                  : undefined
              }
            >
              <rect
                x={rectX}
                y={rectY}
                width={w}
                height={h}
                rx={7}
                className={styles.chipRect}
              />
              <text
                x={textX}
                y={base.y}
                textAnchor={anchor}
                dominantBaseline="central"
                className={styles.chipText}
                aria-hidden="true"
              >
                {lines.map((ln, li) => (
                  <tspan
                    key={`${uid}-${i}-${li}`}
                    x={textX}
                    dy={li === 0 ? (lines.length === 2 ? "-0.5em" : "0") : "1em"}
                  >
                    {ln}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}

        {/* Centre readout (e.g. the composite score). */}
        {centerValue ? (
          <>
            <text x={CX} y={CY - 2} textAnchor="middle" className={styles.centerValue}>
              {centerValue}
            </text>
            {centerLabel ? (
              <text x={CX} y={CY + 22} textAnchor="middle" className={styles.centerLabel}>
                {centerLabel}
              </text>
            ) : null}
          </>
        ) : null}
      </svg>

      <ul className={styles.legend}>
        {orderedSeries.map((s) => (
          <li key={s.key} className={styles.legendItem}>
            <span
              className={`${styles.swatch} ${
                s.variant === "current" ? styles.swatchCurrent : styles.swatchBaseline
              }`}
              aria-hidden="true"
            />
            {s.label}
          </li>
        ))}
        <li className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchTarget}`} aria-hidden="true" />
          {targetZoneLabel}
        </li>
        <li className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchRed}`} aria-hidden="true" />
          {redZoneLabel}
        </li>
      </ul>
    </figure>
  );
}
