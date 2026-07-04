import { describe, expect, it } from "vitest";
import { computeScores, inTarget, metricScore, statusFor, type ScoredReading } from "./scoring";

describe("inTarget", () => {
  it("passes everything when there is no target", () => {
    expect(inTarget(null, 0)).toBe(true);
    expect(inTarget(null, -99)).toBe(true);
  });

  it("checks floors, ceilings and ranges inclusively", () => {
    expect(inTarget({ kind: "floor", value: 10 }, 10)).toBe(true);
    expect(inTarget({ kind: "floor", value: 10 }, 9.9)).toBe(false);
    expect(inTarget({ kind: "ceiling", value: 5 }, 5)).toBe(true);
    expect(inTarget({ kind: "ceiling", value: 5 }, 5.1)).toBe(false);
    expect(inTarget({ kind: "range", min: 4, max: 6 }, 4)).toBe(true);
    expect(inTarget({ kind: "range", min: 4, max: 6 }, 6)).toBe(true);
    expect(inTarget({ kind: "range", min: 4, max: 6 }, 3.9)).toBe(false);
  });
});

describe("statusFor", () => {
  it("is watch when no target exists (nothing to judge against)", () => {
    expect(statusFor(null, 7)).toBe("watch");
  });

  it("bands a floor target: in target, near miss within 10%, flag beyond", () => {
    expect(statusFor({ kind: "floor", value: 10 }, 10)).toBe("on_track");
    expect(statusFor({ kind: "floor", value: 10 }, 9)).toBe("watch");
    expect(statusFor({ kind: "floor", value: 10 }, 8.9)).toBe("flag");
  });

  it("bands a ceiling target the same way upwards", () => {
    expect(statusFor({ kind: "ceiling", value: 5 }, 5)).toBe("on_track");
    expect(statusFor({ kind: "ceiling", value: 5 }, 5.5)).toBe("watch");
    expect(statusFor({ kind: "ceiling", value: 5 }, 5.6)).toBe("flag");
  });

  it("bands a range target by half the span either side", () => {
    const target = { kind: "range", min: 4, max: 6 } as const;
    expect(statusFor(target, 5)).toBe("on_track");
    expect(statusFor(target, 3)).toBe("watch"); // min - span/2 = 3
    expect(statusFor(target, 2.9)).toBe("flag");
    expect(statusFor(target, 7)).toBe("watch"); // max + span/2 = 7
    expect(statusFor(target, 7.1)).toBe("flag");
  });
});

describe("metricScore", () => {
  it("weights 60% latest-vs-target and 40% consistency", () => {
    // Latest on target (10 pts); 2 of 3 recent readings in target.
    const score = metricScore({ kind: "floor", value: 10 }, [8, 10, 12], 12);
    expect(score).toBeCloseTo(0.6 * 10 + 0.4 * (2 / 3) * 10, 5);
  });

  it("scores a perfect run as 10", () => {
    expect(metricScore({ kind: "floor", value: 10 }, [10, 11, 12], 12)).toBe(10);
  });

  it("falls back to the current value when there is no history", () => {
    // On target with no history: consistency judged on the single reading.
    expect(metricScore({ kind: "floor", value: 10 }, [], 12)).toBe(10);
  });

  it("only counts the last 12 readings for consistency", () => {
    // 13 readings, the oldest (a miss) should fall outside the window.
    const history = [0, ...Array<number>(12).fill(10)];
    expect(metricScore({ kind: "floor", value: 10 }, history, 10)).toBe(10);
  });
});

describe("computeScores", () => {
  const reading = (
    pillar: ScoredReading["pillar"],
    overrides: Partial<ScoredReading> = {},
  ): ScoredReading => ({
    pillar,
    target: { kind: "floor", value: 10 },
    history: [10, 10],
    current: 10,
    status: "on_track",
    ...overrides,
  });

  it("returns empty results for no readings", () => {
    expect(computeScores([])).toEqual({ pillars: {}, composite: null, reviewStatus: null });
  });

  it("averages metrics per pillar and pillars into the composite", () => {
    const result = computeScores([
      reading("exercise"), // 10
      reading("nutrition", {
        // Flag (3 pts) and never in target: 0.6*3 + 0 = 1.8
        target: { kind: "ceiling", value: 5 },
        history: [5.6, 5.6],
        current: 5.6,
        status: "flag",
      }),
    ]);
    expect(result.pillars.exercise).toBe(10);
    expect(result.pillars.nutrition).toBe(1.8);
    expect(result.pillars.immune).toBeUndefined();
    expect(result.composite).toBe(5.9);
  });

  it("takes the worst metric status as the review status", () => {
    expect(
      computeScores([reading("exercise"), reading("immune", { status: "watch" })]).reviewStatus,
    ).toBe("watch");
    expect(
      computeScores([reading("exercise"), reading("immune", { status: "flag" })]).reviewStatus,
    ).toBe("flag");
    expect(computeScores([reading("exercise")]).reviewStatus).toBe("on_track");
  });

  it("skips pillars with no readings rather than scoring them zero", () => {
    const result = computeScores([reading("exercise")]);
    expect(Object.keys(result.pillars)).toEqual(["exercise"]);
    expect(result.composite).toBe(10);
  });
});
