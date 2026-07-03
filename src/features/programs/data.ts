import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { MuscleGroup } from "@/components/ui";
import { CATEGORY_ORDER, type ExerciseCategory, type ExerciseOption, type SessionStatus } from "./constants";

export {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  formatPrescription,
  type ExerciseCategory,
  type ExerciseOption,
  type SessionStatus,
} from "./constants";

export type SessionSummaryVM = {
  id: string;
  title: string;
  scheduledFor: string;
  status: SessionStatus;
  categories: ExerciseCategory[];
  exerciseCount: number;
  completedCount: number;
};

export type ProgramVM = {
  id: string;
  clientId: string;
  title: string;
  focus: string | null;
  startsOn: string | null;
  createdByName: string | null;
  bodyMap: "male" | "female";
  upcoming: SessionSummaryVM[]; // soonest first
  history: SessionSummaryVM[]; // most recent first
};

export type SessionExerciseVM = {
  id: string;
  name: string;
  category: ExerciseCategory;
  sets: number | null;
  reps: number | null;
  weightKg: number | null;
  durationMin: number | null;
  distanceKm: number | null;
  notes: string | null;
  equipment: string | null;
  instructions: string | null;
  completed: boolean;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
};

export type SessionDetailVM = {
  id: string;
  clientId: string;
  programTitle: string;
  title: string;
  scheduledFor: string;
  status: SessionStatus;
  completedAt: string | null;
  notes: string | null;
  exercises: SessionExerciseVM[];
  /** Union across the session for the body map: primary wins over secondary. */
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
};

/** Exercise library for pickers and the library panel, grouped by category. */
export async function getExerciseLibrary(): Promise<ExerciseOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exercises")
    .select("id, name, category, equipment, primary_muscles, secondary_muscles")
    .order("category")
    .order("name");
  return (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    equipment: e.equipment,
    primaryMuscles: e.primary_muscles,
    secondaryMuscles: e.secondary_muscles,
  }));
}

/**
 * The client's current (most recent active) programme with its sessions,
 * partitioned into upcoming and history. RLS scopes access: the care team
 * with consent, or the client themselves.
 */
export async function getClientProgram(clientId: string): Promise<ProgramVM | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .select(
      `id, client_id, title, focus, starts_on, created_at,
       created_by_profile:profiles!programs_created_by_fkey(full_name),
       clients(body_map),
       program_sessions(id, title, scheduled_for, status,
         session_exercises(id, completed_at, exercises(category)))`,
    )
    .eq("client_id", clientId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const today = new Date().toISOString().slice(0, 10);
  const sessions: SessionSummaryVM[] = (data.program_sessions ?? []).map((s) => {
    const categories = CATEGORY_ORDER.filter((c) =>
      s.session_exercises.some((se) => se.exercises?.category === c),
    );
    return {
      id: s.id,
      title: s.title,
      scheduledFor: s.scheduled_for,
      status: s.status,
      categories,
      exerciseCount: s.session_exercises.length,
      completedCount: s.session_exercises.filter((se) => se.completed_at != null).length,
    };
  });

  const upcoming = sessions
    .filter((s) => s.scheduledFor >= today && s.status === "scheduled")
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  const history = sessions
    .filter((s) => !(s.scheduledFor >= today && s.status === "scheduled"))
    .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));

  return {
    id: data.id,
    clientId: data.client_id,
    title: data.title,
    focus: data.focus,
    startsOn: data.starts_on,
    createdByName: data.created_by_profile?.full_name ?? null,
    bodyMap: data.clients?.body_map === "female" ? "female" : "male",
    upcoming,
    history,
  };
}

/** One session in full: exercises with prescription, completion and muscles. */
export async function getSessionDetail(sessionId: string): Promise<SessionDetailVM | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("program_sessions")
    .select(
      `id, client_id, title, scheduled_for, status, completed_at, notes,
       programs(title),
       session_exercises(id, position, sets, reps, weight_kg, duration_min,
         distance_km, notes, completed_at,
         exercises(name, category, equipment, instructions, primary_muscles, secondary_muscles))`,
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) return null;

  const exercises: SessionExerciseVM[] = [...data.session_exercises]
    .sort((a, b) => a.position - b.position)
    .map((se) => ({
      id: se.id,
      name: se.exercises?.name ?? "Exercise",
      category: se.exercises?.category ?? "resistance",
      sets: se.sets,
      reps: se.reps,
      weightKg: se.weight_kg,
      durationMin: se.duration_min,
      distanceKm: se.distance_km,
      notes: se.notes,
      equipment: se.exercises?.equipment ?? null,
      instructions: se.exercises?.instructions ?? null,
      completed: se.completed_at != null,
      primaryMuscles: se.exercises?.primary_muscles ?? [],
      secondaryMuscles: se.exercises?.secondary_muscles ?? [],
    }));

  const primary = new Set<MuscleGroup>();
  const secondary = new Set<MuscleGroup>();
  for (const e of exercises) {
    for (const m of e.primaryMuscles) primary.add(m);
    for (const m of e.secondaryMuscles) secondary.add(m);
  }
  for (const m of primary) secondary.delete(m);

  return {
    id: data.id,
    clientId: data.client_id,
    programTitle: data.programs?.title ?? "Programme",
    title: data.title,
    scheduledFor: data.scheduled_for,
    status: data.status,
    completedAt: data.completed_at,
    notes: data.notes,
    exercises,
    primaryMuscles: Array.from(primary),
    secondaryMuscles: Array.from(secondary),
  };
}

export type CategoryTrend = {
  category: ExerciseCategory;
  label: string;
  caption: string;
  unit: string;
  /** One value per completed session that included this category, oldest first. */
  values: number[];
  latest: number | null;
  /** Percentage change from the first non-zero value to the latest, if known. */
  changePct: number | null;
};

export type PerformanceOverview = {
  trends: CategoryTrend[];
  completedCount: number;
  missedCount: number;
  /** Sessions whose date has passed (completed + missed). */
  pastCount: number;
  upcomingCount: number;
};

/**
 * Progress per category across every completed session (all blocks): total
 * weight moved for resistance, active minutes for cardiovascular, minutes for
 * mobility. Simple, explainable measures, not clinical scores.
 */
export async function getPerformanceOverview(clientId: string): Promise<PerformanceOverview> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("program_sessions")
    .select(
      `id, scheduled_for, status,
       session_exercises(sets, reps, weight_kg, duration_min, exercises(category))`,
    )
    .eq("client_id", clientId)
    .order("scheduled_for");

  const sessions = data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const completed = sessions.filter((s) => s.status === "completed");

  const seriesFor = (category: ExerciseCategory): number[] => {
    const values: number[] = [];
    for (const s of completed) {
      const entries = s.session_exercises.filter((se) => se.exercises?.category === category);
      if (entries.length === 0) continue;
      const value =
        category === "resistance"
          ? entries.reduce((sum, e) => sum + (e.sets ?? 1) * (e.reps ?? 1) * (e.weight_kg ?? 0), 0)
          : entries.reduce((sum, e) => sum + (e.duration_min ?? 0), 0);
      // A session with only unweighted or untimed work says nothing about
      // this measure, so it does not drag the trend to zero.
      if (value > 0) values.push(Math.round(value * 10) / 10);
    }
    return values;
  };

  const trend = (
    category: ExerciseCategory,
    label: string,
    caption: string,
    unit: string,
  ): CategoryTrend => {
    const values = seriesFor(category);
    const latest = values.at(-1) ?? null;
    const first = values.find((v) => v > 0);
    const changePct =
      latest != null && first != null && first > 0 && values.length >= 2
        ? Math.round(((latest - first) / first) * 100)
        : null;
    return { category, label, caption, unit, values, latest, changePct };
  };

  return {
    trends: [
      trend("resistance", "Strength", "Total weight moved per session", "kg"),
      trend("cardiovascular", "Cardiovascular", "Active minutes per session", "min"),
      trend("mobility", "Mobility", "Mobility minutes per session", "min"),
    ],
    completedCount: completed.length,
    missedCount: sessions.filter((s) => s.status === "missed").length,
    pastCount: sessions.filter((s) => s.scheduled_for < today).length,
    upcomingCount: sessions.filter((s) => s.scheduled_for >= today && s.status === "scheduled")
      .length,
  };
}

export type BlockVM = {
  id: string;
  title: string;
  focus: string | null;
  status: "active" | "completed" | "archived";
  startsOn: string | null;
  createdByName: string | null;
  firstSession: string | null;
  lastSession: string | null;
  sessionCount: number;
  completedCount: number;
};

/** Every block (programme) for this client, newest first, with date spans. */
export async function getBlocks(clientId: string): Promise<BlockVM[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("programs")
    .select(
      `id, title, focus, status, starts_on, created_at,
       created_by_profile:profiles!programs_created_by_fkey(full_name),
       program_sessions(scheduled_for, status)`,
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((p) => {
    const dates = p.program_sessions.map((s) => s.scheduled_for).sort();
    return {
      id: p.id,
      title: p.title,
      focus: p.focus,
      status: (["active", "completed", "archived"].includes(p.status)
        ? p.status
        : "archived") as BlockVM["status"],
      startsOn: p.starts_on,
      createdByName: p.created_by_profile?.full_name ?? null,
      firstSession: dates[0] ?? null,
      lastSession: dates.at(-1) ?? null,
      sessionCount: p.program_sessions.length,
      completedCount: p.program_sessions.filter((s) => s.status === "completed").length,
    };
  });
}

export type CalendarSession = {
  id: string;
  title: string;
  status: SessionStatus;
  scheduledFor: string;
};

/** All of this client's sessions between two dates (inclusive), for the calendar. */
export async function getSessionsBetween(
  clientId: string,
  startIso: string,
  endIso: string,
): Promise<CalendarSession[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("program_sessions")
    .select("id, title, status, scheduled_for")
    .eq("client_id", clientId)
    .gte("scheduled_for", startIso)
    .lte("scheduled_for", endIso)
    .order("scheduled_for");
  return (data ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    scheduledFor: s.scheduled_for,
  }));
}

/** The signed-in client's own record (id + body figure), or null. */
export async function getOwnClient(): Promise<{
  clientId: string;
  bodyMap: "male" | "female";
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("clients")
    .select("id, body_map")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return { clientId: data.id, bodyMap: data.body_map === "female" ? "female" : "male" };
}
