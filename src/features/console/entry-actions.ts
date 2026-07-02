"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { isRole, isClinical } from "@/lib/roles";

export type EntryState = { error: string | null; success: string | null };

const metricSchema = z.object({
  clientId: z.string().uuid(),
  metricCode: z.string().min(1),
  value: z.coerce.number().finite(),
});

const actionSchema = z.object({
  clientId: z.string().uuid(),
  text: z.string().trim().min(5, "Write the action in full so the team can follow it."),
  isFlag: z.coerce.boolean(),
  clientVisible: z.coerce.boolean(),
  severity: z.string().trim().optional(),
});

/**
 * All clinician writes follow the same pattern: verify the session belongs to
 * a clinical role AND that RLS lets them see this client (care team with
 * consent), then perform the write with the service-role client and append an
 * audit_log entry. The session's own RLS read is the authorisation check.
 */
async function requireClinicalAccess(clientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;
  if (!user || !isRole(role) || !isClinical(role)) return null;

  // Visible through RLS only if the caller is on the care team with consent.
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return null;

  return user;
}

function computeStatus(
  targetDef: unknown,
  value: number,
): "on_track" | "watch" | "flag" {
  const t = targetDef as { kind?: string; value?: number; min?: number; max?: number } | null;
  if (!t?.kind) return "watch";
  if (t.kind === "floor" && t.value != null) {
    if (value >= t.value) return "on_track";
    return value >= t.value * 0.9 ? "watch" : "flag";
  }
  if (t.kind === "ceiling" && t.value != null) {
    if (value <= t.value) return "on_track";
    return value <= t.value * 1.1 ? "watch" : "flag";
  }
  if (t.kind === "range" && t.min != null && t.max != null) {
    if (value >= t.min && value <= t.max) return "on_track";
    const span = t.max - t.min;
    return value >= t.min - span * 0.5 && value <= t.max + span * 0.5 ? "watch" : "flag";
  }
  return "watch";
}

/** Record a metric reading against the client's latest weekly review. */
export async function recordMetric(_prev: EntryState, formData: FormData): Promise<EntryState> {
  const parsed = metricSchema.safeParse({
    clientId: formData.get("clientId"),
    metricCode: formData.get("metricCode"),
    value: formData.get("value"),
  });
  if (!parsed.success) return { error: "Enter a number for the reading.", success: null };
  const { clientId, metricCode, value } = parsed.data;

  const user = await requireClinicalAccess(clientId);
  if (!user) return { error: "You do not have access to this client.", success: null };

  const admin = getAdminClient();

  const { data: review } = await admin
    .from("weekly_reviews")
    .select("id, week_no")
    .eq("client_id", clientId)
    .order("week_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!review) return { error: "This client has no weekly review to record against.", success: null };

  const { data: metric } = await admin
    .from("metrics_catalog")
    .select("code, name, target_def")
    .eq("code", metricCode)
    .maybeSingle();
  if (!metric) return { error: "Unknown metric.", success: null };

  const status = computeStatus(metric.target_def, value);

  const { data: existing } = await admin
    .from("metric_readings")
    .select("id, current, history")
    .eq("review_id", review.id)
    .eq("metric_code", metricCode)
    .maybeSingle();

  if (existing) {
    const history = Array.isArray(existing.history) ? (existing.history as number[]) : [];
    const { error } = await admin
      .from("metric_readings")
      .update({
        previous: existing.current,
        current: value,
        delta: existing.current != null ? Number((value - existing.current).toFixed(2)) : null,
        status,
        history: [...history, value].slice(-12),
      })
      .eq("id", existing.id);
    if (error) return { error: "Could not save the reading. Try again.", success: null };
  } else {
    const { error } = await admin.from("metric_readings").insert({
      review_id: review.id,
      metric_code: metricCode,
      current: value,
      previous: null,
      delta: null,
      status,
      history: [value],
    });
    if (error) return { error: "Could not save the reading. Try again.", success: null };
  }

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "metric_reading.recorded",
    entity: "metric_readings",
    entity_id: review.id,
    meta: { client_id: clientId, metric_code: metricCode, value, status, week_no: review.week_no },
  });

  revalidatePath("/console");
  return { error: null, success: `${metric.name} recorded: ${value} (${status.replace("_", " ")}).` };
}

/** Add an action or safety flag to the client's latest weekly review. */
export async function addAction(_prev: EntryState, formData: FormData): Promise<EntryState> {
  const parsed = actionSchema.safeParse({
    clientId: formData.get("clientId"),
    text: formData.get("text"),
    isFlag: formData.get("isFlag") === "on",
    clientVisible: formData.get("clientVisible") === "on",
    severity: formData.get("severity") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the action text.", success: null };
  }
  const { clientId, text, isFlag, severity } = parsed.data;
  // Load-bearing safety rule: a safety flag is never client-visible.
  const clientVisible = isFlag ? false : parsed.data.clientVisible;

  const user = await requireClinicalAccess(clientId);
  if (!user) return { error: "You do not have access to this client.", success: null };

  const admin = getAdminClient();
  const { data: review } = await admin
    .from("weekly_reviews")
    .select("id, week_no")
    .eq("client_id", clientId)
    .order("week_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!review) return { error: "This client has no weekly review to record against.", success: null };

  const { data: inserted, error } = await admin
    .from("actions_flags")
    .insert({
      review_id: review.id,
      text,
      is_flag: isFlag,
      severity: isFlag ? (severity || "moderate") : null,
      client_visible: clientVisible,
    })
    .select("id")
    .single();
  if (error || !inserted) return { error: "Could not save the action. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: isFlag ? "safety_flag.raised" : "action.added",
    entity: "actions_flags",
    entity_id: inserted.id,
    meta: { client_id: clientId, week_no: review.week_no, client_visible: clientVisible },
  });

  revalidatePath("/console");
  return {
    error: null,
    success: isFlag ? "Safety flag raised for the clinical team." : "Action added.",
  };
}
