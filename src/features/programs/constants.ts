/* Shared between server reads and client-side forms: keep this module free of
 * server-only imports. */

import type { MuscleGroup } from "@/components/ui";
import type { Database } from "@/types/database.types";

export type ExerciseCategory = Database["public"]["Enums"]["exercise_category"];
export type SessionStatus = Database["public"]["Enums"]["session_status"];

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  cardiovascular: "Cardiovascular",
  resistance: "Resistance",
  mobility: "Mobility",
};

export const CATEGORY_ORDER: readonly ExerciseCategory[] = [
  "cardiovascular",
  "resistance",
  "mobility",
];

export type ExerciseOption = {
  id: string;
  name: string;
  category: ExerciseCategory;
  equipment: string | null;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
};

/* ── Calendar (pure date maths, UTC throughout) ─────────────────────── */

export type CalendarDayVM = {
  iso: string;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  inActiveBlock: boolean;
  sessions: { id: string; title: string; status: SessionStatus }[];
};

export type CalendarVM = {
  monthIso: string; // YYYY-MM
  label: string; // "July 2026"
  prevMonthIso: string;
  nextMonthIso: string;
  gridStartIso: string;
  gridEndIso: string;
  weeks: CalendarDayVM[][];
};

function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthIsoOf(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function parseMonth(monthIso: string): { y: number; m: number } {
  const y = Number(monthIso.slice(0, 4));
  const m = Number(monthIso.slice(5, 7));
  return { y, m };
}

/** The Monday-to-Sunday grid range that covers one month. */
export function calendarRange(monthIso: string): { startIso: string; endIso: string } {
  const { y, m } = parseMonth(monthIso);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  const end = new Date(last);
  end.setUTCDate(last.getUTCDate() + ((7 - last.getUTCDay()) % 7));
  return { startIso: isoOf(start), endIso: isoOf(end) };
}

/**
 * Month grid (weeks starting Monday) with this client's sessions placed on
 * their days and the active block's span highlighted.
 */
export function buildCalendar(
  monthIso: string,
  sessions: { id: string; title: string; status: SessionStatus; scheduledFor: string }[],
  activeRange: { start: string; end: string } | null,
  todayIso: string,
): CalendarVM {
  const { y, m } = parseMonth(monthIso);
  const { startIso, endIso } = calendarRange(monthIso);

  const byDay = new Map<string, CalendarDayVM["sessions"]>();
  for (const s of sessions) {
    const list = byDay.get(s.scheduledFor) ?? [];
    list.push({ id: s.id, title: s.title, status: s.status });
    byDay.set(s.scheduledFor, list);
  }

  const weeks: CalendarDayVM[][] = [];
  const cursor = new Date(`${startIso}T00:00:00Z`);
  while (isoOf(cursor) <= endIso) {
    const week: CalendarDayVM[] = [];
    for (let i = 0; i < 7; i += 1) {
      const iso = isoOf(cursor);
      week.push({
        iso,
        dayOfMonth: cursor.getUTCDate(),
        inMonth: monthIsoOf(cursor) === monthIso,
        isToday: iso === todayIso,
        inActiveBlock:
          activeRange != null && iso >= activeRange.start && iso <= activeRange.end,
        sessions: byDay.get(iso) ?? [],
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }

  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const prev = new Date(Date.UTC(y, m - 2, 1));
  const next = new Date(Date.UTC(y, m, 1));

  return {
    monthIso,
    label,
    prevMonthIso: monthIsoOf(prev),
    nextMonthIso: monthIsoOf(next),
    gridStartIso: startIso,
    gridEndIso: endIso,
    weeks,
  };
}

/** "Fri 3 Jul" — session dates on the console surface. */
export function formatSessionDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** "3 sets of 10 at 12.5 kg", "10 min", "2 km" — whatever was prescribed. */
export function formatPrescription(e: {
  sets: number | null;
  reps: number | null;
  weightKg: number | null;
  durationMin: number | null;
  distanceKm: number | null;
}): string {
  const parts: string[] = [];
  if (e.sets != null && e.reps != null) parts.push(`${e.sets} sets of ${e.reps}`);
  else if (e.sets != null) parts.push(`${e.sets} sets`);
  if (e.weightKg != null) parts.push(`at ${e.weightKg} kg`);
  if (e.durationMin != null) parts.push(`${e.durationMin} min`);
  if (e.distanceKm != null) parts.push(`${e.distanceKm} km`);
  return parts.join(" ");
}
