import styles from "./metric-detail.module.css";

export type TargetDef =
  | { kind: "floor"; value: number }
  | { kind: "ceiling"; value: number }
  | { kind: "range"; min: number; max: number }
  | null;

/**
 * Detailed history chart for the metric drill-down: 12-week line with the
 * target zone shaded, gridlines and start/end labels. Pure SVG, no library.
 */
export function MetricDetailChart({
  values,
  target,
  unit,
}: {
  values: number[];
  target: TargetDef;
  unit: string | null;
}) {
  const W = 640;
  const H = 260;
  const PAD_L = 48;
  const PAD_R = 20;
  const PAD_T = 18;
  const PAD_B = 34;

  if (values.length < 2) {
    return <p className={styles.chartEmpty}>Not enough history yet: two readings are needed for a trend.</p>;
  }

  const targetValues =
    target == null
      ? []
      : target.kind === "range"
        ? [target.min, target.max]
        : [target.value];
  let lo = Math.min(...values, ...targetValues);
  let hi = Math.max(...values, ...targetValues);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.12;
  lo -= pad;
  hi += pad;

  const x = (i: number) => PAD_L + (i / (values.length - 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);

  /* The shaded band is the zone the team is aiming for. */
  let bandTop: number | null = null;
  let bandBottom: number | null = null;
  if (target?.kind === "floor") {
    bandTop = y(hi);
    bandBottom = y(target.value);
  } else if (target?.kind === "ceiling") {
    bandTop = y(target.value);
    bandBottom = y(lo);
  } else if (target?.kind === "range") {
    bandTop = y(target.max);
    bandBottom = y(target.min);
  }

  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const gridLines = [0.25, 0.5, 0.75].map((f) => PAD_T + f * (H - PAD_T - PAD_B));
  const last = values[values.length - 1]!;

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Trend over the last ${values.length} readings${unit ? `, in ${unit}` : ""}`}
    >
      {bandTop != null && bandBottom != null ? (
        <>
          <rect
            x={PAD_L}
            y={bandTop}
            width={W - PAD_L - PAD_R}
            height={Math.max(bandBottom - bandTop, 0)}
            fill="var(--c-blue-tint)"
            opacity="0.55"
          />
          {/* Label sits bottom-left inside the band, away from the value
              callout (top right) and the latest data point. Skipped when the
              band is too thin to hold text. */}
          {bandBottom - bandTop >= 22 ? (
            <text
              x={PAD_L + 8}
              y={bandBottom - 8}
              textAnchor="start"
              className={styles.bandLabel}
            >
              target zone
            </text>
          ) : null}
        </>
      ) : null}

      {gridLines.map((gy) => (
        <line key={gy} x1={PAD_L} y1={gy} x2={W - PAD_R} y2={gy} stroke="var(--c-line)" />
      ))}

      {/* Y extents, pinned to the plot's top and bottom edges */}
      <text x={PAD_L - 8} y={PAD_T + 4} textAnchor="end" className={styles.axisLabel}>
        {Number(hi.toFixed(1))}
      </text>
      <text x={PAD_L - 8} y={H - PAD_B + 4} textAnchor="end" className={styles.axisLabel}>
        {Number(lo.toFixed(1))}
      </text>

      <polyline
        points={points}
        fill="none"
        stroke="var(--c-slate)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {values.map((v, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(v)}
          r={i === values.length - 1 ? 5 : 3}
          fill={i === values.length - 1 ? "var(--c-amber)" : "var(--c-slate)"}
        />
      ))}

      {/* Latest value called out near its point: above it, or below when the
          point sits close to the top of the plot. */}
      <text
        x={Math.min(x(values.length - 1) - 8, W - PAD_R - 4)}
        y={y(last) < PAD_T + 26 ? y(last) + 20 : y(last) - 12}
        textAnchor="end"
        className={styles.currentLabel}
      >
        {last}
        {unit ? ` ${unit}` : ""}
      </text>

      <text x={PAD_L} y={H - 10} className={styles.axisLabel}>
        {values.length - 1} weeks ago
      </text>
      <text x={W - PAD_R} y={H - 10} textAnchor="end" className={styles.axisLabel}>
        This week
      </text>
    </svg>
  );
}
