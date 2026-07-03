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
