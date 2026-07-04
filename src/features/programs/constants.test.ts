import { describe, expect, it } from "vitest";
import { buildCalendar, calendarRange, formatPrescription } from "./constants";

describe("calendarRange", () => {
  it("covers a month starting mid-week from the previous Monday to the next Sunday", () => {
    // July 2026 starts on a Wednesday and ends on a Friday.
    expect(calendarRange("2026-07")).toEqual({ startIso: "2026-06-29", endIso: "2026-08-02" });
  });

  it("keeps a month that starts on a Monday flush at the start", () => {
    // June 2026 starts on a Monday and ends on a Tuesday.
    expect(calendarRange("2026-06")).toEqual({ startIso: "2026-06-01", endIso: "2026-07-05" });
  });
});

describe("buildCalendar", () => {
  const sessions = [
    { id: "a", title: "Session 1", status: "completed" as const, scheduledFor: "2026-07-03" },
    { id: "b", title: "Session 2", status: "scheduled" as const, scheduledFor: "2026-07-03" },
    { id: "c", title: "Session 3", status: "missed" as const, scheduledFor: "2026-07-10" },
  ];

  it("builds Monday-first weeks of seven days covering the whole grid", () => {
    const cal = buildCalendar("2026-07", sessions, null, "2026-07-04");
    expect(cal.weeks).toHaveLength(5);
    for (const week of cal.weeks) expect(week).toHaveLength(7);
    expect(cal.weeks[0]![0]!.iso).toBe(cal.gridStartIso);
    expect(cal.weeks.at(-1)!.at(-1)!.iso).toBe(cal.gridEndIso);
  });

  it("marks days outside the month, today, and places sessions on their days", () => {
    const cal = buildCalendar("2026-07", sessions, null, "2026-07-04");
    const days = cal.weeks.flat();
    expect(days.find((d) => d.iso === "2026-06-29")!.inMonth).toBe(false);
    expect(days.find((d) => d.iso === "2026-07-01")!.inMonth).toBe(true);
    expect(days.find((d) => d.iso === "2026-07-04")!.isToday).toBe(true);
    expect(days.filter((d) => d.isToday)).toHaveLength(1);
    expect(days.find((d) => d.iso === "2026-07-03")!.sessions.map((s) => s.id)).toEqual(["a", "b"]);
    expect(days.find((d) => d.iso === "2026-07-10")!.sessions).toHaveLength(1);
  });

  it("tints exactly the active block's span", () => {
    const cal = buildCalendar(
      "2026-07",
      [],
      { start: "2026-07-06", end: "2026-07-12" },
      "2026-07-04",
    );
    const days = cal.weeks.flat();
    expect(days.find((d) => d.iso === "2026-07-05")!.inActiveBlock).toBe(false);
    expect(days.find((d) => d.iso === "2026-07-06")!.inActiveBlock).toBe(true);
    expect(days.find((d) => d.iso === "2026-07-12")!.inActiveBlock).toBe(true);
    expect(days.find((d) => d.iso === "2026-07-13")!.inActiveBlock).toBe(false);
  });

  it("navigates months across year boundaries", () => {
    expect(buildCalendar("2026-01", [], null, "2026-01-10").prevMonthIso).toBe("2025-12");
    expect(buildCalendar("2026-12", [], null, "2026-12-10").nextMonthIso).toBe("2027-01");
    expect(buildCalendar("2026-07", [], null, "2026-07-04").label).toBe("July 2026");
  });
});

describe("formatPrescription", () => {
  it("describes whatever was prescribed, in order", () => {
    expect(
      formatPrescription({ sets: 3, reps: 10, weightKg: 12.5, durationMin: null, distanceKm: null }),
    ).toBe("3 sets of 10 at 12.5 kg");
    expect(
      formatPrescription({ sets: null, reps: null, weightKg: null, durationMin: 10, distanceKm: 2 }),
    ).toBe("10 min 2 km");
    expect(
      formatPrescription({ sets: null, reps: null, weightKg: null, durationMin: null, distanceKm: null }),
    ).toBe("");
  });
});
