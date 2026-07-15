"use client";

import { useMemo, useState } from "react";

import styles from "./body-map.module.css";
import type { BodyRegion } from "./bodyMapAssets/types";
import {
  MUSCLE_LABELS,
  type Figure,
  type MuscleGroup,
  type View,
  getOutline,
  getRegions,
  musclesForSlug,
  regionPaths,
} from "./bodyMapGeometry";

/** Perceived effort per worked muscle group, on Borg CR10 (0 to 10). */
export type EffortMap = Partial<Record<MuscleGroup, number>>;

/** Direction of a recorded effort relative to the clinician's aimed intensity. */
type EffortStatus = "onTarget" | "eased" | "harder" | "recorded";

const STATUS_WORD: Record<EffortStatus, string> = {
  onTarget: "On plan",
  eased: "Easier than planned",
  harder: "Harder than planned",
  recorded: "Recorded",
};

/* Borg CR10 anchor words. Only the anchors are named; the steps between them
 * sit on the same scale. Copy is plain, second person, no dashes. */
const CR10_DESCRIPTORS: Record<number, string> = {
  0: "Rest, nothing at all",
  2: "Easy",
  4: "Moderate",
  6: "Hard",
  8: "Very hard",
  10: "Maximal effort",
};

const CR10_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

function describe(value: number): string {
  if (CR10_DESCRIPTORS[value]) return CR10_DESCRIPTORS[value]!;
  // Fall back to the nearest lower anchor so every step reads sensibly.
  for (let v = value; v >= 0; v -= 1) {
    if (CR10_DESCRIPTORS[v]) return CR10_DESCRIPTORS[v]!;
  }
  return "";
}

/** Direction to aimed intensity. With no target we simply mark it recorded. */
function statusFor(effort: number, aimed: number | undefined): EffortStatus {
  if (aimed == null) return "recorded";
  const delta = effort - aimed;
  if (delta >= 2) return "harder";
  if (delta <= -2) return "eased";
  return "onTarget";
}

/** The single muscle group a region should behave as for a given session: the
 * one actually worked (in `regions`), else its first mapped group. Keeps the
 * shared upper-back / lats shape unambiguous to select and colour. */
function activeMuscle(slug: string, inPlay: Set<MuscleGroup>): MuscleGroup | undefined {
  const muscles = musclesForSlug(slug);
  return muscles.find((m) => inPlay.has(m)) ?? muscles[0];
}

function InteractiveRegion({
  region,
  muscle,
  isInPlay,
  selected,
  effort,
  aimed,
  readOnly,
  onSelect,
}: {
  region: BodyRegion;
  muscle: MuscleGroup | undefined;
  isInPlay: boolean;
  selected: boolean;
  effort: number | undefined;
  aimed: number | undefined;
  readOnly: boolean;
  onSelect: (m: MuscleGroup) => void;
}) {
  const rated = effort != null;
  const status = rated ? statusFor(effort!, aimed) : null;

  const cls = [
    styles.region,
    !isInPlay ? styles.inert : "",
    isInPlay && !rated ? styles.inPlay : "",
    status ? styles[status] : "",
    selected ? styles.selected : "",
  ]
    .filter(Boolean)
    .join(" ");

  const label = muscle ? MUSCLE_LABELS[muscle] : region.slug;
  const title = rated
    ? `${label}: effort ${effort} of 10${aimed != null ? `, aimed ${aimed}` : ""} (${STATUS_WORD[status!]})`
    : isInPlay
      ? `${label}: worked this session, not yet rated`
      : label;

  const interactive = isInPlay && !readOnly && muscle != null;

  return (
    <g
      className={cls}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-label={interactive ? title : undefined}
      onClick={interactive ? () => onSelect(muscle!) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(muscle!);
              }
            }
          : undefined
      }
    >
      {isInPlay ? <title>{title}</title> : null}
      {regionPaths(region).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
  );
}

function RateFigure({
  view,
  figure,
  inPlay,
  selected,
  effort,
  aimed,
  readOnly,
  onSelect,
}: {
  view: View;
  figure: Figure;
  inPlay: Set<MuscleGroup>;
  selected: MuscleGroup | null;
  effort: EffortMap;
  aimed: EffortMap;
  readOnly: boolean;
  onSelect: (m: MuscleGroup) => void;
}) {
  const regions = getRegions(figure, view);
  const outline = getOutline(figure, view);

  return (
    <svg
      viewBox={outline.viewBox}
      role="group"
      aria-label={`${view} view, tap a highlighted region to rate effort`}
    >
      <path className={styles.body} d={outline.d} />
      {regions.map((region) => {
        const muscle = activeMuscle(region.slug, inPlay);
        const isInPlay = muscle != null && inPlay.has(muscle);
        return (
          <InteractiveRegion
            key={region.slug}
            region={region}
            muscle={muscle}
            isInPlay={isInPlay}
            selected={muscle != null && selected === muscle}
            effort={muscle ? effort[muscle] : undefined}
            aimed={muscle ? aimed[muscle] : undefined}
            readOnly={readOnly}
            onSelect={onSelect}
          />
        );
      })}
    </svg>
  );
}

/**
 * Interactive body map for rating perceived effort (Borg CR10) against a
 * clinician's aimed intensity. Clients tap a worked region and pick a number;
 * the region colours by DIRECTION to the aimed intensity, never by raw effort,
 * and never by colour alone (the legend names every rated region in words, and
 * each region carries a <title>). No flag-red on the client app.
 *
 * Controlled or uncontrolled: pass `effort` + `onRate` to control it, or
 * `defaultEffort` to let it hold its own state. `readOnly` renders the console
 * review view (no input).
 */
export function BodyMapRate({
  regions,
  aimed = {},
  effort: controlledEffort,
  defaultEffort = {},
  figure = "male",
  readOnly = false,
  onRate,
}: {
  /** Muscle groups worked this session, i.e. the tappable regions. */
  regions: MuscleGroup[];
  /** Clinician's aimed intensity per region, Borg CR10. */
  aimed?: EffortMap;
  /** Controlled perceived-effort values. */
  effort?: EffortMap;
  /** Initial values when uncontrolled. */
  defaultEffort?: EffortMap;
  figure?: Figure;
  readOnly?: boolean;
  onRate?: (muscle: MuscleGroup, value: number) => void;
}) {
  const [view, setView] = useState<View>("front");
  const [selected, setSelected] = useState<MuscleGroup | null>(null);
  const [internal, setInternal] = useState<EffortMap>(defaultEffort);

  const effort = controlledEffort ?? internal;
  const inPlay = useMemo(() => new Set(regions), [regions]);

  function setValue(muscle: MuscleGroup, value: number) {
    if (!controlledEffort) setInternal((prev) => ({ ...prev, [muscle]: value }));
    onRate?.(muscle, value);
  }

  function onSelect(muscle: MuscleGroup) {
    setSelected((cur) => (cur === muscle ? null : muscle));
  }

  const selectedValue = selected != null ? effort[selected] : undefined;
  const selectedAimed = selected != null ? aimed[selected] : undefined;

  // Legend rows: every rated region, named with its value and direction word.
  const ratedRows = regions
    .filter((m) => effort[m] != null)
    .map((m) => {
      const value = effort[m]!;
      const status = statusFor(value, aimed[m]);
      return { muscle: m, value, aimed: aimed[m], status };
    });

  const dotClass: Record<EffortStatus, string> = {
    onTarget: styles.dotOnTarget!,
    eased: styles.dotEased!,
    harder: styles.dotHarder!,
    recorded: styles.dotRecorded!,
  };

  return (
    <div className={styles.rateWrap}>
      <div className={styles.viewToggle} role="tablist" aria-label="Body view">
        {(["front", "back"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            className={`${styles.viewToggleBtn} ${view === v ? styles.viewToggleActive : ""}`}
            onClick={() => setView(v)}
          >
            {v === "front" ? "Front" : "Back"}
          </button>
        ))}
      </div>

      <figure className={styles.figure}>
        <RateFigure
          view={view}
          figure={figure}
          inPlay={inPlay}
          selected={selected}
          effort={effort}
          aimed={aimed}
          readOnly={readOnly}
          onSelect={onSelect}
        />
      </figure>

      {!readOnly && selected != null ? (
        <div className={styles.rateControl}>
          <div className={styles.rateControlHead}>
            <span className={styles.rateRegionName}>{MUSCLE_LABELS[selected]}</span>
            {selectedAimed != null ? (
              <span className={styles.rateAimed}>Aimed {selectedAimed} of 10</span>
            ) : null}
          </div>
          <p className={styles.ratePrompt}>How hard did this feel? Tap a number from 0 to 10.</p>
          <div
            className={styles.scale}
            role="group"
            aria-label={`Perceived effort for ${MUSCLE_LABELS[selected]}`}
          >
            {CR10_VALUES.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={selectedValue === v}
                className={`${styles.scaleBtn} ${selectedValue === v ? styles.scaleBtnActive : ""}`}
                onClick={() => setValue(selected, v)}
              >
                {v}
              </button>
            ))}
          </div>
          {selectedValue != null ? (
            <p className={styles.scaleDescriptor}>
              {selectedValue} of 10, {describe(selectedValue).toLowerCase()}
            </p>
          ) : null}
        </div>
      ) : null}

      {!readOnly && selected == null ? (
        <p className={styles.ratePrompt}>Tap a highlighted muscle to rate how hard it felt.</p>
      ) : null}

      <dl className={styles.rateLegend}>
        {ratedRows.length > 0 ? (
          ratedRows.map((r) => (
            <div key={r.muscle} className={styles.rateLegendRow}>
              <span className={`${styles.rateLegendDot} ${dotClass[r.status]}`} aria-hidden="true" />
              <dt className={styles.rateLegendName}>{MUSCLE_LABELS[r.muscle]}</dt>
              <dd className={styles.rateLegendMeta}>
                effort {r.value} of 10
                {r.aimed != null ? `, aimed ${r.aimed}` : ""}, {STATUS_WORD[r.status].toLowerCase()}
              </dd>
            </div>
          ))
        ) : (
          <p className={styles.legendEmpty}>No effort recorded yet.</p>
        )}
      </dl>
    </div>
  );
}
