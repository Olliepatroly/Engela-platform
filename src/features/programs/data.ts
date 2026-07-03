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
