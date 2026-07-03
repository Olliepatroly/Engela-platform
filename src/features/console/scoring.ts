/**
 * Scoring engine — pure functions, no I/O.
 *
 * Each metric scores 0 to 10 from two components:
 *   * on-target (60%): where the LATEST reading sits against the effective
 *     target (client override or catalogue default): in target 10, near miss
 *     6.5, well outside 3 (the same bands as the status pill).
 *   * consistency (40%): the share of recent readings (up to 12) inside the
 *     target. Being on target this week matters most; holding it matters too.
 *
 * A pillar score is the mean of its metric scores; the composite is the mean
 * of the pillars that have data. The review status is the worst metric status
 * (colour by direction of clinical benefit is already encoded in target_def).
 */

export type Target =
  | { kind: "floor"; value: number }
  | { kind: "ceiling"; value: number }
  | { kind: "range"; min: number; max: number }
  | null;

export type MetricStatus = "on_track" | "watch" | "flag";
export type Pillar = "exercise" | "nutrition" | "immune";

export function inTarget(target: Target, value: number): boolean {
  if (!target) return true;
  if (target.kind === "floor") return value >= target.value;
  if (target.kind === "ceiling") return value <= target.value;
  return value >= target.min && value <= target.max;
}

/** Status bands: in target, near miss (watch), well outside (flag). */
export function statusFor(target: Target, value: number): MetricStatus {
  if (!target) return "watch";
  if (target.kind === "floor") {
    if (value >= target.value) return "on_track";
    return value >= target.value * 0.9 ? "watch" : "flag";
  }
  if (target.kind === "ceiling") {
    if (value <= target.value) return "on_track";
    return value <= target.value * 1.1 ? "watch" : "flag";
  }
  if (value >= target.min && value <= target.max) return "on_track";
  const span = target.max - target.min;
  return value >= target.min - span * 0.5 && value <= target.max + span * 0.5 ? "watch" : "flag";
}

const STATUS_POINTS: Record<MetricStatus, number> = {
  on_track: 10,
  watch: 6.5,
  flag: 3,
};

/** 0 to 10 for one metric: 60% latest-vs-target, 40% consistency. */
export function metricScore(target: Target, history: number[], current: number): number {
  const onTarget = STATUS_POINTS[statusFor(target, current)];
  const recent = history.length > 0 ? history.slice(-12) : [current];
  const hits = recent.filter((v) => inTarget(target, v)).length;
  const consistency = (hits / recent.length) * 10;
  return 0.6 * onTarget + 0.4 * consistency;
}

export type ScoredReading = {
  pillar: Pillar;
  target: Target;
  history: number[];
  current: number;
  status: MetricStatus;
};

export type ScoreResult = {
  pillars: Partial<Record<Pillar, number>>;
  composite: number | null;
  reviewStatus: MetricStatus | null;
};

const STATUS_RANK: Record<MetricStatus, number> = { on_track: 0, watch: 1, flag: 2 };

export function computeScores(readings: ScoredReading[]): ScoreResult {
  const pillars: Partial<Record<Pillar, number>> = {};
  for (const pillar of ["exercise", "nutrition", "immune"] as Pillar[]) {
    const own = readings.filter((r) => r.pillar === pillar);
    if (own.length === 0) continue;
    const mean = own.reduce((sum, r) => sum + metricScore(r.target, r.history, r.current), 0) / own.length;
    pillars[pillar] = Math.round(mean * 10) / 10;
  }

  const scores = Object.values(pillars);
  const composite =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null;

  const reviewStatus =
    readings.length > 0
      ? readings.reduce<MetricStatus>(
          (worst, r) => (STATUS_RANK[r.status] > STATUS_RANK[worst] ? r.status : worst),
          "on_track",
        )
      : null;

  return { pillars, composite, reviewStatus };
}
