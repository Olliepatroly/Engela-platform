import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ParqAnswers } from "./parq";

/**
 * The signed-in client's own health profile, read through RLS (a client can
 * only ever read their own row). Holds the PAR-Q screening and the clinical
 * details the care team keeps with the account.
 */
export type HealthProfileVM = {
  parqCompleted: boolean;
  parqCompletedAt: string | null;
  parqPositive: boolean | null;
  parqAnswers: ParqAnswers | null;
  details: Record<string, string>;
};

export async function getOwnHealthProfile(): Promise<HealthProfileVM> {
  const empty: HealthProfileVM = {
    parqCompleted: false,
    parqCompletedAt: null,
    parqPositive: null,
    parqAnswers: null,
    details: {},
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_health_profiles")
    .select("parq, parq_completed_at, parq_positive, details")
    .maybeSingle();
  if (error || !data) return empty;

  const rawDetails = (data.details ?? {}) as Record<string, unknown>;
  const details: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawDetails)) {
    if (typeof value === "string" && value.trim()) details[key] = value;
  }

  return {
    parqCompleted: data.parq_completed_at != null,
    parqCompletedAt: data.parq_completed_at,
    parqPositive: data.parq_positive,
    parqAnswers: (data.parq as { answers?: ParqAnswers } | null)?.answers ?? null,
    details,
  };
}
