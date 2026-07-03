import type { ReactNode } from "react";
import type { Database } from "@/types/database.types";
import styles from "./body-map.module.css";

export type MuscleGroup = Database["public"]["Enums"]["muscle_group"];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  traps: "Trapezius",
  shoulders: "Shoulders",
  chest: "Chest",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abdominals: "Abdominals",
  obliques: "Obliques",
  upper_back: "Upper back",
  lats: "Lats",
  lower_back: "Lower back",
  glutes: "Glutes",
  quadriceps: "Quadriceps",
  hamstrings: "Hamstrings",
  calves: "Calves",
};

type Figure = "male" | "female";
type View = "front" | "back";

/* Figure proportions (viewBox 0 0 190 420, centre x = 95). The female figure
 * uses narrower shoulders, a narrower waist and wider hips; muscle shapes are
 * computed from the same parameters so they stay on the body. */
type Proportions = {
  sh: number; // shoulder half width
  w: number; // waist half width
  h: number; // hip half width
  armW: number;
  thighW: number;
  calfW: number;
};

const PROPORTIONS: Record<Figure, Proportions> = {
  male: { sh: 40, w: 26, h: 32, armW: 15, thighW: 24, calfW: 16 },
  female: { sh: 34, w: 21, h: 37, armW: 12, thighW: 22, calfW: 14 },
};

const CX = 95;

function torsoPath(p: Proportions): string {
  const { sh, w, h } = p;
  return [
    `M ${CX - sh + 6} 54`,
    `Q ${CX - sh} 57 ${CX - sh} 66`,
    `L ${CX - w} 140`,
    `C ${CX - w - 2} 158 ${CX - h} 160 ${CX - h} 175`,
    `Q ${CX - h} 194 ${CX - h + 10} 198`,
    `L ${CX + h - 10} 198`,
    `Q ${CX + h} 194 ${CX + h} 175`,
    `C ${CX + h} 160 ${CX + w + 2} 158 ${CX + w} 140`,
    `L ${CX + sh} 66`,
    `Q ${CX + sh} 57 ${CX + sh - 6} 54`,
    `C ${CX + sh - 20} 48 ${CX - sh + 20} 48 ${CX - sh + 6} 54`,
    "Z",
  ].join(" ");
}

/** The neutral body: head, torso, limbs. Same shape front and back. */
function Silhouette({ p }: { p: Proportions }) {
  const limbs: [number, number, number, number, number][] = [];
  for (const side of [-1, 1]) {
    // Upper arm, forearm.
    limbs.push([CX + side * (p.sh - 4), 64, CX + side * (p.sh + 8), 120, p.armW]);
    limbs.push([CX + side * (p.sh + 8), 120, CX + side * (p.sh + 14), 168, p.armW - 2]);
    // Thigh, lower leg.
    limbs.push([CX + side * 16, 192, CX + side * 15, 275, p.thighW]);
    limbs.push([CX + side * 15, 275, CX + side * 14, 362, p.calfW]);
  }
  return (
    <g className={styles.body} aria-hidden="true">
      <circle cx={CX} cy={28} r={16} />
      <rect x={CX - 8} y={40} width={16} height={12} />
      <path d={torsoPath(p)} />
      {limbs.map(([x1, y1, x2, y2, w], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={w} strokeLinecap="round" />
      ))}
      {[-1, 1].map((side) => (
        <g key={side}>
          <circle cx={CX + side * (p.sh + 15)} cy={175} r={6} />
          <ellipse cx={CX + side * 16} cy={372} rx={10} ry={6} />
        </g>
      ))}
    </g>
  );
}

type MuscleShape = { muscle: MuscleGroup; node: (key: string) => ReactNode };

/** Highlightable muscle regions for one view, positioned off the figure's
 * proportions. Symmetric muscles render one shape per side. */
function muscleShapes(view: View, p: Proportions): MuscleShape[] {
  const { sh, w } = p;
  const shapes: MuscleShape[] = [];
  const both = (muscle: MuscleGroup, make: (side: number, key: string) => ReactNode) => {
    shapes.push({ muscle, node: (key) => [-1, 1].map((s) => make(s, `${key}-${s}`)) });
  };

  if (view === "front") {
    both("traps", (s, k) => (
      <path key={k} d={`M ${CX + s * 8} 50 L ${CX + s * (sh - 6)} 58 L ${CX + s * 10} 63 Z`} />
    ));
    both("shoulders", (s, k) => <circle key={k} cx={CX + s * (sh - 2)} cy={64} r={10} />);
    both("chest", (s, k) => <ellipse key={k} cx={CX + s * 18} cy={82} rx={16} ry={12} />);
    both("biceps", (s, k) => (
      <ellipse key={k} cx={CX + s * (sh + 2)} cy={95} rx={7} ry={13} />
    ));
    both("forearms", (s, k) => (
      <ellipse key={k} cx={CX + s * (sh + 11)} cy={145} rx={6} ry={15} />
    ));
    shapes.push({
      muscle: "abdominals",
      node: (k) => <rect key={k} x={CX - 12} y={98} width={24} height={46} rx={8} />,
    });
    both("obliques", (s, k) => <ellipse key={k} cx={CX + s * (w - 2)} cy={122} rx={6} ry={14} />);
    both("quadriceps", (s, k) => <ellipse key={k} cx={CX + s * 16} cy={235} rx={11} ry={26} />);
    both("calves", (s, k) => <ellipse key={k} cx={CX + s * 14} cy={320} rx={6} ry={18} />);
  } else {
    shapes.push({
      muscle: "traps",
      node: (k) => (
        <path key={k} d={`M ${CX} 48 L ${CX - 24} 64 L ${CX} 96 L ${CX + 24} 64 Z`} />
      ),
    });
    both("shoulders", (s, k) => <circle key={k} cx={CX + s * (sh - 2)} cy={64} r={10} />);
    both("upper_back", (s, k) => <ellipse key={k} cx={CX + s * 15} cy={100} rx={9} ry={9} />);
    both("triceps", (s, k) => (
      <ellipse key={k} cx={CX + s * (sh + 2)} cy={96} rx={7} ry={13} />
    ));
    both("forearms", (s, k) => (
      <ellipse key={k} cx={CX + s * (sh + 11)} cy={145} rx={6} ry={15} />
    ));
    both("lats", (s, k) => (
      <ellipse
        key={k}
        cx={CX + s * 19}
        cy={120}
        rx={9}
        ry={19}
        transform={`rotate(${s * 10} ${CX + s * 19} 120)`}
      />
    ));
    shapes.push({
      muscle: "lower_back",
      node: (k) => <rect key={k} x={CX - 10} y={132} width={20} height={24} rx={7} />,
    });
    both("glutes", (s, k) => <ellipse key={k} cx={CX + s * 13} cy={183} rx={12} ry={13} />);
    both("hamstrings", (s, k) => <ellipse key={k} cx={CX + s * 16} cy={240} rx={10} ry={26} />);
    both("calves", (s, k) => <ellipse key={k} cx={CX + s * 14} cy={322} rx={7} ry={20} />);
  }
  return shapes;
}

function FigureView({
  view,
  figure,
  primary,
  secondary,
}: {
  view: View;
  figure: Figure;
  primary: Set<MuscleGroup>;
  secondary: Set<MuscleGroup>;
}) {
  const p = PROPORTIONS[figure];
  return (
    <figure className={styles.figure}>
      <svg viewBox="0 0 190 420" role="img" aria-label={`${view} view of the body`}>
        <Silhouette p={p} />
        {muscleShapes(view, p).map(({ muscle, node }) => {
          const kind = primary.has(muscle) ? "primary" : secondary.has(muscle) ? "secondary" : null;
          if (!kind) return null;
          return (
            <g
              key={`${muscle}-${view}`}
              className={kind === "primary" ? styles.primary : styles.secondary}
            >
              <title>{MUSCLE_LABELS[muscle]}</title>
              {node(`${muscle}-${view}`)}
            </g>
          );
        })}
      </svg>
      <figcaption className={styles.viewLabel}>{view === "front" ? "Front" : "Back"}</figcaption>
    </figure>
  );
}

/**
 * Muscles-worked body map (front and back views, male or female figure).
 * Status rule applies here too: colour is never the only signal, so the
 * legend always names the highlighted muscle groups in text.
 */
export function BodyMap({
  primary,
  secondary = [],
  figure = "male",
}: {
  primary: MuscleGroup[];
  secondary?: MuscleGroup[];
  figure?: Figure;
}) {
  const primarySet = new Set(primary);
  // A muscle that is primary anywhere in the session shows as primary.
  const secondarySet = new Set(secondary.filter((m) => !primarySet.has(m)));
  const names = (set: Set<MuscleGroup>) =>
    Array.from(set)
      .map((m) => MUSCLE_LABELS[m])
      .join(", ");

  return (
    <div className={styles.wrap}>
      <div className={styles.figures}>
        <FigureView view="front" figure={figure} primary={primarySet} secondary={secondarySet} />
        <FigureView view="back" figure={figure} primary={primarySet} secondary={secondarySet} />
      </div>
      <dl className={styles.legend}>
        {primarySet.size > 0 ? (
          <div className={styles.legendRow}>
            <dt className={styles.legendTerm}>
              <span className={`${styles.legendDot} ${styles.legendDotPrimary}`} aria-hidden="true" />
              Worked directly
            </dt>
            <dd className={styles.legendNames}>{names(primarySet)}</dd>
          </div>
        ) : null}
        {secondarySet.size > 0 ? (
          <div className={styles.legendRow}>
            <dt className={styles.legendTerm}>
              <span
                className={`${styles.legendDot} ${styles.legendDotSecondary}`}
                aria-hidden="true"
              />
              Also involved
            </dt>
            <dd className={styles.legendNames}>{names(secondarySet)}</dd>
          </div>
        ) : null}
        {primarySet.size === 0 && secondarySet.size === 0 ? (
          <p className={styles.legendEmpty}>No muscle groups highlighted.</p>
        ) : null}
      </dl>
    </div>
  );
}
