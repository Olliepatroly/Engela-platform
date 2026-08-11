import { describe, expect, it } from "vitest";
import { addDays, mondayOf, reviewWindow } from "./review-window";

describe("mondayOf", () => {
  it("leaves a Monday where it is", () => {
    expect(mondayOf("2026-08-10")).toBe("2026-08-10");
  });

  it("steps back to the Monday of a mid-week date", () => {
    expect(mondayOf("2026-08-13")).toBe("2026-08-10");
  });

  it("treats Sunday as the end of the week, not the start", () => {
    // The classic off-by-one: getUTCDay() is 0 on Sunday, so a naive
    // subtraction would leave Sunday as its own week start.
    expect(mondayOf("2026-08-16")).toBe("2026-08-10");
  });

  it("crosses a month boundary", () => {
    expect(mondayOf("2026-09-02")).toBe("2026-08-31");
  });

  it("crosses a year boundary", () => {
    expect(mondayOf("2027-01-01")).toBe("2026-12-28");
  });
});

describe("addDays", () => {
  it("adds within a month", () => {
    expect(addDays("2026-08-10", 6)).toBe("2026-08-16");
  });

  it("adds across a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("reviewWindow", () => {
  it("returns the Monday to Sunday week containing the date", () => {
    expect(reviewWindow("2026-08-13")).toEqual({
      windowStart: "2026-08-10",
      windowEnd: "2026-08-16",
    });
  });

  it("is stable whichever day of the week is passed in", () => {
    const fromMonday = reviewWindow("2026-08-10");
    for (const iso of ["2026-08-11", "2026-08-14", "2026-08-16"]) {
      expect(reviewWindow(iso)).toEqual(fromMonday);
    }
  });
});
