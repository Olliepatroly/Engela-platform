import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { PillStatus, TargetDef } from "@/components/ui";
import type { Database } from "@/types/database.types";
import { CLINICAL_ROLES, type Role } from "@/lib/roles";
import { metricScore, type Target } from "./scoring";

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
  target: TargetDef;
  whyItMatters: string | null;
  /** 0 to 10 sub-score of the latest reading (radar "current" ring). */
  currentScore: number | null;
  /** 0 to 10 sub-score of the earliest reading held (radar "baseline" ring). */
  baselineScore: number | null;
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
  reviewId: string;
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
  /** Who conducted the review and when, which is not who signs it off. */
  conductedByName: string | null;
  conductedAt: string | null;
  /** 'console' when worked up here, 'uploaded' when conducted elsewhere. */
  source: string;
  /** Clinical-only narrative for a review conducted elsewhere. */
  summary: string | null;
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

export type AuditEntryVM = {
  id: string;
  at: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entity: string;
  clientId: string | null;
  clientName: string | null;
  detail: string;
};

/** Human-readable labels for audit actions; unknown codes fall back to the raw code. */
const AUDIT_ACTION_LABELS: Record<string, string> = {
  "weekly_review.signed_off": "Weekly review signed off",
  "weekly_review.opened": "Weekly review opened",
  "weekly_review.conducted": "Weekly review conducted",
  "review_report.uploaded": "Clinical report filed",
  "client.status_changed": "Account status changed",
  "metric_reading.recorded": "Reading recorded",
  "metric_reading.corrected": "Reading corrected",
  "safety_flag.raised": "Safety flag raised",
  "action.added": "Action added",
  "metric_goal.set": "Goal set",
  "consent.granted": "Consent granted",
  "consent.withdrawn": "Consent withdrawn",
  "profile.name_updated": "Name updated",
  "clinician.details_updated": "Professional details updated",
  "session_part.completed": "Session part completed",
  "session_part.reopened": "Session part reopened",
  "team_request.sent": "Team request sent",
  "team_request.accepted": "Team request accepted",
  "team_request.declined": "Team request declined",
  "team_request.cancelled": "Team request withdrawn",
  "program.updated": "Block updated",
  "program.created": "Block started",
  "program_session.added": "Session added",
  "session_exercise.added": "Exercise added to a session",
  "exercise.added": "Exercise added to the library",
  "invite.created": "Invite sent",
  "invite.revoked": "Invite revoked",
  "invite.accepted": "Invite accepted",
  "account_request.created": "Account requested",
  "account_request.handled": "Account request handled",
  "mfa.enrolled": "Two-step verification turned on",
  "mfa.unenrolled": "Two-step verification turned off",
  "audit.exported": "Audit trail exported",
};

function auditDetail(meta: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof meta.metric_code === "string") parts.push(meta.metric_code.replace(/_/g, " "));
  if (meta.value != null) parts.push(`value ${meta.value}`);
  if (meta.week_no != null) parts.push(`week ${meta.week_no}`);
  if (typeof meta.category === "string") parts.push(meta.category);
  if (typeof meta.email === "string") parts.push(meta.email);
  if (typeof meta.role === "string") parts.push(meta.role);
  if (typeof meta.from === "string" && typeof meta.to === "string") {
    parts.push(`${meta.from} to ${meta.to}`);
  }
  if (meta.report_attached === true) parts.push("report attached");
  if (meta.client_visible === true) parts.push("shared with client");
  return parts.join(" · ");
}

/**
 * The append-only audit trail, newest first, for the read-only governance
 * screen. RLS scopes this to the clinical team (audit_log_select_clinical);
 * client names resolve only for clients the viewer can see.
 */
export async function getAuditTrail(limit = 1000): Promise<AuditEntryVM[]> {
  const supabase = await createClient();
  // RLS (audit_log_select_clinical) already scopes these rows to the viewer:
  // admins see everything, everyone else sees their own actions plus rows about
  // clients on their care team with consent granted. Client-scoped rows about
  // anyone else never arrive here, so there is nothing to filter out below.
  const [{ data: rows }, { data: clients }] = await Promise.all([
    supabase
      .from("audit_log")
      .select("id, at, actor_id, action, entity, entity_id, meta, profiles(full_name)")
      .order("at", { ascending: false })
      .limit(limit),
    supabase.from("clients").select("id, profiles!clients_profile_id_fkey(full_name)"),
  ]);

  const clientNames = new Map(
    (clients ?? []).map((c) => [c.id, c.profiles?.full_name ?? "Unknown"]),
  );

  /** The client a row concerns: meta.client_id, or the id itself for consent events. */
  function rowClientId(entity: string, entityId: string | null, meta: Record<string, unknown>) {
    if (typeof meta.client_id === "string") return meta.client_id;
    if (entity === "care_team" && entityId) return entityId;
    return null;
  }

  return (rows ?? []).map((row) => {
    const meta = (row.meta ?? {}) as Record<string, unknown>;
    const clientId = rowClientId(row.entity, row.entity_id, meta);
    return {
      id: row.id,
      at: row.at,
      actorId: row.actor_id,
      actorName: row.profiles?.full_name ?? "System",
      action: AUDIT_ACTION_LABELS[row.action] ?? row.action.replace(/[._]/g, " "),
      entity: row.entity,
      clientId: clientId && clientNames.has(clientId) ? clientId : null,
      clientName: clientId ? (clientNames.get(clientId) ?? null) : null,
      detail: auditDetail(meta),
    };
  });
}

/** Metric options for the Add data form, in catalog display order. */
export async function getMetricOptions(): Promise<
  { code: string; name: string; unit: string | null }[]
> {
  const supabase = await createClient();
  const { data } = await supabase.from("metrics_catalog").select("code, name, unit");
  return (data ?? []).sort(
    (a, b) =>
      METRIC_ORDER.indexOf(a.code as (typeof METRIC_ORDER)[number]) -
      METRIC_ORDER.indexOf(b.code as (typeof METRIC_ORDER)[number]),
  );
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
       issued_at, signed_at, conducted_at, source, summary,
       issued_by_profile:profiles!weekly_reviews_issued_by_fkey(full_name),
       signed_by_profile:profiles!weekly_reviews_signed_by_fkey(full_name),
       conducted_by_profile:profiles!weekly_reviews_conducted_by_fkey(full_name),
       clients(id, mrn, diagnosis, treatment_phase, programme_week,
         profiles!clients_profile_id_fkey(full_name)),
       pillar_scores(pillar, score, baseline),
       metric_readings(metric_code, current, previous, delta, status, history,
         metrics_catalog(code, pillar, name, unit, target_def, is_estimate, why_it_matters)),
       actions_flags(id, text, is_flag, severity, client_visible)`,
    )
    .eq("client_id", clientId)
    .order("week_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.clients) return null;

  // Per-client goal overrides: the effective target everywhere on this page.
  const { data: overrides } = await supabase
    .from("client_metric_targets")
    .select("metric_code, target_def")
    .eq("client_id", clientId);
  const overrideMap = new Map(
    (overrides ?? []).map((o) => [o.metric_code, o.target_def as TargetDef]),
  );

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
        .map((m) => {
          const effective =
            overrideMap.get(m.metric_code) ??
            ((m.metrics_catalog?.target_def ?? null) as TargetDef);
          const history = Array.isArray(m.history) ? (m.history as number[]) : [];
          // Radar sub-scores share the metric's 0-to-10 scoring so unlike units
          // (kg, bpm, hrs) sit on one axis. Baseline reuses the earliest reading
          // held; current is the latest. Target always scores 10 (the outer ring).
          const target = effective as Target;
          const currentScore = m.current != null ? metricScore(target, history, m.current) : null;
          const baselineValue = history.length > 0 ? history[0] : m.current;
          const baselineScore =
            baselineValue != null ? metricScore(target, [baselineValue], baselineValue) : null;
          return {
            code: m.metric_code,
            name: m.metrics_catalog?.name ?? m.metric_code,
            unit: m.metrics_catalog?.unit ?? null,
            isEstimate: m.metrics_catalog?.is_estimate ?? false,
            targetText:
              targetText(effective) +
              (overrideMap.has(m.metric_code) ? " (goal set for this client)" : ""),
            current: formatValue(m.metric_code, m.current),
            previous: formatValue(m.metric_code, m.previous),
            deltaText: formatDelta(m.metric_code, m.delta),
            status: (m.status as PillStatus | null) ?? null,
            history,
            target: effective,
            whyItMatters: m.metrics_catalog?.why_it_matters ?? null,
            currentScore,
            baselineScore,
          };
        });
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
    reviewId: data.id,
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
    conductedByName: data.conducted_by_profile?.full_name ?? null,
    conductedAt: data.conducted_at,
    source: data.source,
    summary: data.summary,
  };
}

/* ── Clients without a review yet ─────────────────────────────────────── */

export type ClientSummaryVM = {
  clientId: string;
  fullName: string;
  mrn: string;
  diagnosis: string;
  treatmentPhase: string | null;
  programmeWeek: number | null;
  /** active | paused | discharged. Drives the client app's own state. */
  status: string;
  /** The week a newly opened review should default to. */
  suggestedWeekNo: number;
  /** Whether this client has any weekly review at all. */
  hasReview: boolean;
  parqCompletedAt: string | null;
  /** True when any PAR-Q answer was "yes", so the team follows up first. */
  parqPositive: boolean | null;
};

/**
 * The header and setup facts for one client, readable whether or not they have
 * a weekly review yet. This is what lets the console show a newly invited
 * client (and the controls to get them started) instead of a dead end. RLS
 * scopes every read to the viewer's care team.
 */
export async function getClientSummary(clientId: string): Promise<ClientSummaryVM | null> {
  const supabase = await createClient();

  const [{ data: client }, { data: reviews }, { data: profile }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, mrn, diagnosis, treatment_phase, programme_week, status, profiles!clients_profile_id_fkey(full_name)",
      )
      .eq("id", clientId)
      .maybeSingle(),
    supabase
      .from("weekly_reviews")
      .select("week_no")
      .eq("client_id", clientId)
      .order("week_no", { ascending: false })
      .limit(1),
    supabase
      .from("client_health_profiles")
      .select("parq_completed_at, parq_positive")
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);

  if (!client) return null;

  const latestWeek = reviews?.[0]?.week_no ?? null;

  return {
    clientId: client.id,
    fullName: client.profiles?.full_name ?? "Unknown",
    mrn: client.mrn,
    diagnosis: client.diagnosis,
    treatmentPhase: client.treatment_phase,
    programmeWeek: client.programme_week,
    status: client.status,
    suggestedWeekNo: latestWeek != null ? latestWeek + 1 : (client.programme_week ?? 1),
    hasReview: latestWeek != null,
    parqCompletedAt: profile?.parq_completed_at ?? null,
    parqPositive: profile?.parq_positive ?? null,
  };
}

/* ── Clinical reports ─────────────────────────────────────────────────── */

export type ReportVM = {
  id: string;
  kind: string;
  kindLabel: string;
  title: string;
  note: string | null;
  fileName: string;
  conductedOn: string | null;
  /** The report's author: their profile name, else the name typed in. */
  authorName: string | null;
  uploadedByName: string;
  createdAt: string;
  weekNo: number | null;
  /** Short-lived signed URL; null if the object has gone missing. */
  url: string | null;
};

export const REPORT_KIND_LABELS: Record<string, string> = {
  consultant_review: "Consultant review",
  bloods: "Bloods",
  dexa: "DEXA scan",
  clinic_letter: "Clinic letter",
  other: "Other document",
};

/**
 * Clinical PDFs held for one client, newest first. RLS
 * (review_reports_select_care_team) scopes the rows; signed URLs are minted
 * with the service role for the rows the viewer was allowed to read, and
 * expire in an hour. These documents are clinical-only and never reach the
 * client app.
 */
export async function getClientReports(clientId: string): Promise<ReportVM[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_reports")
    .select(
      `id, kind, title, note, file_name, storage_path, conducted_on, conducted_by_name, created_at,
       weekly_reviews(week_no),
       author:profiles!review_reports_conducted_by_fkey(full_name),
       uploader:profiles!review_reports_uploaded_by_fkey(full_name)`,
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error || !data || data.length === 0) return [];

  const admin = getAdminClient();
  const reports: ReportVM[] = [];
  for (const row of data) {
    const { data: signed } = await admin.storage
      .from("clinical-reports")
      .createSignedUrl(row.storage_path, 60 * 60);
    reports.push({
      id: row.id,
      kind: row.kind,
      kindLabel: REPORT_KIND_LABELS[row.kind] ?? "Document",
      title: row.title,
      note: row.note,
      fileName: row.file_name,
      conductedOn: row.conducted_on,
      authorName: row.author?.full_name ?? row.conducted_by_name,
      uploadedByName: row.uploader?.full_name ?? "Clinical team",
      createdAt: row.created_at,
      weekNo: row.weekly_reviews?.week_no ?? null,
      url: signed?.signedUrl ?? null,
    });
  }
  return reports;
}

/* ── Clinical home overview ───────────────────────────────────────────── */

/** Display labels for the clinical roles shown in the team overview. */
const ROLE_LABELS: Record<Role, string> = {
  consultant: "Consultants",
  nurse: "Specialist nurses",
  cep: "Exercise physiologists",
  physio: "Physiotherapists",
  admin: "Admins",
  client: "Clients",
};

export type TeamMemberVM = {
  id: string;
  fullName: string;
  role: Role;
};

export type TeamGroupVM = {
  role: Role;
  label: string;
  members: TeamMemberVM[];
};

export type HomeOverviewVM = {
  /** Clients on the viewer's care team with an active programme (RLS scoped). */
  activeClients: number;
  /** All clients on the viewer's care team, whatever their programme status. */
  totalClients: number;
  /** Clients whose latest review is flagged, for a quick "needs a look" count. */
  flaggedClients: number;
  /** Clinical colleagues grouped by discipline (empty groups dropped). */
  team: TeamGroupVM[];
};

/**
 * Everything the clinical home needs above the flags queue: how many clients
 * the viewer carries, and the wider clinical team by discipline. Client counts
 * are RLS scoped to the viewer's care team; the team roster is readable to any
 * clinical account (profiles_select_self_or_clinical), safe fields only.
 */
export async function getHomeOverview(roster: RosterEntry[]): Promise<HomeOverviewVM> {
  const supabase = await createClient();

  const [{ data: clients }, { data: members }] = await Promise.all([
    supabase.from("clients").select("status"),
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", [...CLINICAL_ROLES])
      .order("full_name"),
  ]);

  const clientRows = clients ?? [];
  const activeClients = clientRows.filter((c) => c.status === "active").length;

  const flaggedClients = roster.filter((r) => r.reviewStatus === "flag").length;

  // Group colleagues by role, preserving the clinical-team order.
  const team: TeamGroupVM[] = CLINICAL_ROLES.map((role) => ({
    role,
    label: ROLE_LABELS[role],
    members: (members ?? [])
      .filter((m) => m.role === role)
      .map((m) => ({ id: m.id, fullName: m.full_name, role: m.role as Role })),
  })).filter((group) => group.members.length > 0);

  return {
    activeClients,
    totalClients: clientRows.length,
    flaggedClients,
    team,
  };
}
