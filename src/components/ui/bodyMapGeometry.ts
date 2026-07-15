import type { Database } from "@/types/database.types";

import { bodyBack } from "./bodyMapAssets/bodyBack";
import { bodyFemaleBack } from "./bodyMapAssets/bodyFemaleBack";
import { bodyFemaleFront } from "./bodyMapAssets/bodyFemaleFront";
import { bodyFront } from "./bodyMapAssets/bodyFront";
import { OUTLINES, type Outline } from "./bodyMapAssets/outline";
import type { BodyRegion } from "./bodyMapAssets/types";

export type MuscleGroup = Database["public"]["Enums"]["muscle_group"];
export type Figure = "male" | "female";
export type View = "front" | "back";
export type { BodyRegion };

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

/* ── Slug ↔ muscle group ──────────────────────────────────────────────
 * The vendored figure keys regions by the library's slug. Map each to our
 * clinical muscle_group enum. Unmapped slugs (hair, head, neck, hands, feet,
 * knees, ankles, adductors, tibialis) are inert anatomy that add realism but
 * are never rated. `lats` has no distinct shape on this figure, so it shares
 * the `upper-back` region. */
export const MUSCLE_TO_SLUG: Record<MuscleGroup, string> = {
  traps: "trapezius",
  shoulders: "deltoids",
  chest: "chest",
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearm",
  abdominals: "abs",
  obliques: "obliques",
  upper_back: "upper-back",
  lats: "upper-back",
  lower_back: "lower-back",
  glutes: "gluteal",
  quadriceps: "quadriceps",
  hamstrings: "hamstring",
  calves: "calves",
};

/* Inverse: every muscle group a given region draws. Usually one; the
 * `upper-back` region covers both upper_back and lats. */
const SLUG_TO_MUSCLES: Record<string, MuscleGroup[]> = (() => {
  const map: Record<string, MuscleGroup[]> = {};
  (Object.keys(MUSCLE_TO_SLUG) as MuscleGroup[]).forEach((muscle) => {
    const slug = MUSCLE_TO_SLUG[muscle];
    (map[slug] ??= []).push(muscle);
  });
  return map;
})();

/** The muscle groups a drawn region represents (empty for inert anatomy). */
export function musclesForSlug(slug: string): MuscleGroup[] {
  return SLUG_TO_MUSCLES[slug] ?? [];
}

/** All path fragments of a region, flattened (we rate a whole group, not a
 * side, so left/right/common are drawn together). */
export function regionPaths(region: BodyRegion): string[] {
  return [...(region.path.common ?? []), ...(region.path.left ?? []), ...(region.path.right ?? [])];
}

export function getRegions(figure: Figure, view: View): BodyRegion[] {
  if (figure === "female") return view === "front" ? bodyFemaleFront : bodyFemaleBack;
  return view === "front" ? bodyFront : bodyBack;
}

export function getOutline(figure: Figure, view: View): Outline {
  return OUTLINES[figure][view];
}
