import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PillStatus } from "@/components/ui";
import type { Database } from "@/types/database.types";

type Pillar = Database["public"]["Enums"]["pillar"];
type MetricStatus = Database["public"]["Enums"]["metric_status"];

/* Display order within each pillar mirrors the demo's worked example. */
const METRIC_ORDER = [
  "lean_muscle_mass",
  "grip_strength",
  "vo2_max",
  "resting_hr",
  "activity_sessions",
  "active_time",
  "protein_intake",
  "visceral_fat",
  "neutrophils",
  "crp",
  "hrv",
  "sleep",
] as const;

export const PILLAR_LABELS: Record<Pillar, string> = {
  exercise: "Exercise",
  nutrition: "Nutrition",
  immune: "Immune health",
};

export type RosterEntry = {
  clientId: string;
  fullName: string;
  mrn: string;
  week: number | null;
  reviewStatus: MetricStatus | null;
};

export type MetricRowVM = {
  code: string;
  name: string;
  unit: string | null;
  isEstimate: boolean;
  targetText: string;
  current: string;
  previous: string;
  deltaText: string;
  status: PillStatus | null;
  history: number[];
};

export type PillarSectionVM = {
  pillar: Pillar;
  label: string;
  score: number | null;
  baseline: number | null;
  metrics: MetricRowVM[];
};

export type ActionVM = {
  id: string;
  text: string;
  isFlag: boolean;
  severity: string | null;
  clientVisible: boolean;
};

export type ReviewVM = {
  patient: {
    clientId: string;
    fullName: string;
    mrn: string;
    diagnosis: string;
    treatmentPhase: string | null;
    programmeWeek: number | null;
  };
  weekNo: number;
  windowStart: string;
  windowEnd: string;
  compositeScore: number | null;
  status: MetricStatus | null;
  context: Record<string, string>;
  pillars: PillarSectionVM[];
  actions: ActionVM[];
  issuedByName: string | null;
  issuedAt: string | null;
  signedByName: string | null;
  signedAt: string | null;
};

/** Minutes → "hh:mm" for the active_time metric. */
function minutesToHhMm(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatValue(code: string, value: number | null): string {
  if (value == null) return "–";
  if (code === "active_time") return minutesToHhMm(value);
  return String(value);
}

function formatDelta(code: string, delta: number | null): string {
  if (delta == null) return "–";
  const sign = delta > 0 ? "+" : "";
  if (code === "active_time") return `${sign}${Math.round(delta)} min`;
  return `${sign}${delta}`;
}

function targetText(targetDef: unknown): string {
  const t = targetDef as { kind?: string; value?: number; min?: number; max?: number } | null;
  if (!t?.kind) return "";
  if (t.kind === "floor") return `Target at or above ${t.value}`;
  if (t.kind === "ceiling") return `Target at or below ${t.value}`;
  if (t.kind === "range") return `Target ${t.min} to ${t.max}`;
  return "";
}

/**
 * Patients visible to the signed-in clinician. RLS does the real scoping:
 * this query returns only clients whose care_team includes the caller.
 */
export async function getRoster(): Promise<RosterEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, mrn, programme_week, profiles!clients_profile_id_fkey(full_name), weekly_reviews(week_no, status)",
    )
    .order("mrn");

  if (error || !data) return [];

  return data.map((row) => {
    const latest = [...(row.weekly_reviews ?? [])].sort((a, b) => b.week_no - a.week_no)[0];
    return {
      clientId: row.id,
      fullName: row.profiles?.full_name ?? "Unknown",
      mrn: row.mrn,
      week: latest?.week_no ?? row.programme_week,
      reviewStatus: latest?.status ?? null,
    };
  });
}

/** Latest weekly review for one patient, shaped for the console. */
export async function getLatestReview(clientId: string): Promise<ReviewVM | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_reviews")
    .select(
      `id, week_no, window_start, window_end, composite_score, status, context,
       issued_at, signed_at,
       issued_by_profile:profiles!weekly_reviews_issued_by_fkey(full_name),
       signed_by_profile:profiles!weekly_reviews_signed_by_fkey(full_name),
       clients(id, mrn, diagnosis, treatment_phase, programme_week,
         profiles!clients_profile_id_fkey(full_name)),
       pillar_scores(pillar, score, baseline),
       metric_readings(metric_code, current, previous, delta, status, history,
         metrics_catalog(code, pillar, name, unit, target_def, is_estimate)),
       actions_flags(id, text, is_flag, severity, client_visible)`,
    )
    .eq("client_id", clientId)
    .order("week_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.clients) return null;

  const pillars: PillarSectionVM[] = (["exercise", "nutrition", "immune"] as Pillar[]).map(
    (pillar) => {
      const score = data.pillar_scores.find((p) => p.pillar === pillar);
      const metrics = data.metric_readings
        .filter((m) => m.metrics_catalog?.pillar === pillar)
        .sort(
          (a, b) =>
            METRIC_ORDER.indexOf(a.metric_code as (typeof METRIC_ORDER)[number]) -
            METRIC_ORDER.indexOf(b.metric_code as (typeof METRIC_ORDER)[number]),
        )
        .map((m) => ({
          code: m.metric_code,
          name: m.metrics_catalog?.name ?? m.metric_code,
          unit: m.metrics_catalog?.unit ?? null,
          isEstimate: m.metrics_catalog?.is_estimate ?? false,
          targetText: targetText(m.metrics_catalog?.target_def),
          current: formatValue(m.metric_code, m.current),
          previous: formatValue(m.metric_code, m.previous),
          deltaText: formatDelta(m.metric_code, m.delta),
          status: (m.status as PillStatus | null) ?? null,
          history: Array.isArray(m.history) ? (m.history as number[]) : [],
        }));
      return {
        pillar,
        label: PILLAR_LABELS[pillar],
        score: score?.score ?? null,
        baseline: score?.baseline ?? null,
        metrics,
      };
    },
  );

  const actions: ActionVM[] = [...data.actions_flags]
    .sort((a, b) => Number(b.is_flag) - Number(a.is_flag))
    .map((a) => ({
      id: a.id,
      text: a.text,
      isFlag: a.is_flag,
      severity: a.severity,
      clientVisible: a.client_visible,
    }));

  return {
    patient: {
      clientId: data.clients.id,
      fullName: data.clients.profiles?.full_name ?? "Unknown",
      mrn: data.clients.mrn,
      diagnosis: data.clients.diagnosis,
      treatmentPhase: data.clients.treatment_phase,
      programmeWeek: data.clients.programme_week,
    },
    weekNo: data.week_no,
    windowStart: data.window_start,
    windowEnd: data.window_end,
    compositeScore: data.composite_score,
    status: data.status,
    context: (data.context ?? {}) as Record<string, string>,
    pillars,
    actions,
    issuedByName: data.issued_by_profile?.full_name ?? null,
    issuedAt: data.issued_at,
    signedByName: data.signed_by_profile?.full_name ?? null,
    signedAt: data.signed_at,
  };
}
