"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { isRole, isClinical } from "@/lib/roles";
import { statusFor, computeScores, type Target, type ScoredReading, type Pillar } from "./scoring";

export type EntryState = { error: string | null; success: string | null };

const metricSchema = z.object({
  clientId: z.string().uuid(),
  reviewId: z.string().uuid().optional(),
  metricCode: z.string().min(1),
  value: z.coerce.number().finite(),
  recordedAt: z.string().optional(),
  correction: z.boolean(),
});

const actionSchema = z.object({
  clientId: z.string().uuid(),
  reviewId: z.string().uuid().optional(),
  text: z.string().trim().min(5, "Write the action in full so the team can follow it."),
  isFlag: z.coerce.boolean(),
  clientVisible: z.coerce.boolean(),
  severity: z.string().trim().optional(),
});

const openReviewSchema = z
  .object({
    clientId: z.string().uuid(),
    weekNo: z.coerce.number().int().min(1, "Week numbers start at 1.").max(520),
    conductedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Check the date the review was conducted."),
    windowStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Check the week's start date."),
    windowEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Check the week's end date."),
    summary: z.string().trim().max(4000).optional(),
  })
  .refine((r) => r.windowStart <= r.windowEnd, {
    message: "The week's start date must come before its end date.",
  });

const clientStatusSchema = z
  .object({
    clientId: z.string().uuid(),
    status: z.enum(["active", "paused", "discharged"]),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((s) => s.status === "active" || (s.note != null && s.note.length >= 5), {
    message: "Say why the record is being paused or discharged, for the audit trail.",
  });

const signOffSchema = z.object({
  clientId: z.string().uuid(),
  reviewId: z.string().uuid(),
  confirmed: z.literal(true, {
    errorMap: () => ({ message: "Tick the confirmation before signing off." }),
  }),
});

const goalSchema = z
  .object({
    clientId: z.string().uuid(),
    metricCode: z.string().min(1),
    kind: z.enum(["floor", "ceiling", "range"]),
    value: z.coerce.number().finite().optional(),
    min: z.coerce.number().finite().optional(),
    max: z.coerce.number().finite().optional(),
  })
  .refine((g) => (g.kind === "range" ? g.min != null && g.max != null && g.min < g.max : g.value != null), {
    message: "Enter the goal value (for a band, a lower and a higher one).",
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

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return null;

  return user;
}

type AdminClient = ReturnType<typeof getAdminClient>;

/** Effective target for one metric: client override, else catalogue default. */
async function effectiveTarget(
  admin: AdminClient,
  clientId: string,
  metricCode: string,
): Promise<Target> {
  const { data: override } = await admin
    .from("client_metric_targets")
    .select("target_def")
    .eq("client_id", clientId)
    .eq("metric_code", metricCode)
    .maybeSingle();
  if (override) return override.target_def as Target;
  const { data: metric } = await admin
    .from("metrics_catalog")
    .select("target_def")
    .eq("code", metricCode)
    .maybeSingle();
  return (metric?.target_def ?? null) as Target;
}

/**
 * Recompute pillar scores, the composite and the review status from all
 * readings on the review, using effective targets. Runs after every reading,
 * correction and goal change: the score always reflects the data.
 */
async function recomputeReviewScores(admin: AdminClient, reviewId: string, clientId: string) {
  const { data: readings } = await admin
    .from("metric_readings")
    .select("metric_code, current, history, status, metrics_catalog(pillar, target_def)")
    .eq("review_id", reviewId);
  if (!readings || readings.length === 0) return;

  const { data: overrides } = await admin
    .from("client_metric_targets")
    .select("metric_code, target_def")
    .eq("client_id", clientId);
  const overrideMap = new Map((overrides ?? []).map((o) => [o.metric_code, o.target_def as Target]));

  const scored: ScoredReading[] = readings
    .filter((r) => r.current != null && r.metrics_catalog != null)
    .map((r) => ({
      pillar: r.metrics_catalog!.pillar as Pillar,
      target: overrideMap.get(r.metric_code) ?? ((r.metrics_catalog!.target_def ?? null) as Target),
      history: Array.isArray(r.history) ? (r.history as number[]) : [],
      current: r.current!,
      status: r.status ?? "watch",
    }));
  if (scored.length === 0) return;

  const result = computeScores(scored);

  for (const [pillar, score] of Object.entries(result.pillars)) {
    const { data: existing } = await admin
      .from("pillar_scores")
      .select("id")
      .eq("review_id", reviewId)
      .eq("pillar", pillar as Pillar)
      .maybeSingle();
    if (existing) {
      await admin.from("pillar_scores").update({ score }).eq("id", existing.id);
    } else {
      await admin.from("pillar_scores").insert({ review_id: reviewId, pillar: pillar as Pillar, score });
    }
  }

  await admin
    .from("weekly_reviews")
    .update({ composite_score: result.composite, status: result.reviewStatus })
    .eq("id", reviewId);
}

async function latestReview(admin: AdminClient, clientId: string) {
  const { data } = await admin
    .from("weekly_reviews")
    .select("id, week_no")
    .eq("client_id", clientId)
    .order("week_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/**
 * The review an entry belongs to: the week the clinician is looking at when
 * the form carries one (a back-dated week can be on screen while a later week
 * exists), otherwise the client's latest. A review id from the form is only
 * honoured if it belongs to this client.
 */
async function resolveReview(admin: AdminClient, clientId: string, reviewId?: string | null) {
  if (reviewId) {
    const { data } = await admin
      .from("weekly_reviews")
      .select("id, week_no, client_id")
      .eq("id", reviewId)
      .maybeSingle();
    if (data && data.client_id === clientId) return { id: data.id, week_no: data.week_no };
    return null;
  }
  return latestReview(admin, clientId);
}

/** How each status reads in a sentence. */
const STATUS_WORDS: Record<"active" | "paused" | "discharged", string> = {
  active: "active",
  paused: "paused",
  discharged: "discharged",
};

/** Shown wherever an entry has no week to attach to. */
const NO_REVIEW_ERROR =
  "This client has no open review yet. Conduct a review for the week first, then record against it.";

/**
 * Conduct a weekly review: open the week the rest of the record hangs off
 * (readings, actions, flags and goals all attach to a review).
 *
 * Any clinical role on the client's care team may conduct a review, including
 * submitting one that was carried out earlier off-system: "conducted on"
 * carries the real date, so a consultant's clinic review from last Tuesday is
 * recorded as last Tuesday. The CONSULTANT still signs it off (signOffReview),
 * which is the audited clinical act.
 *
 * Opening a client's first review also starts their programme clock: the
 * client's programme week follows the review, and the first week becomes the
 * baseline everything is measured against.
 */
export async function openReview(_prev: EntryState, formData: FormData): Promise<EntryState> {
  const parsed = openReviewSchema.safeParse({
    clientId: formData.get("clientId"),
    weekNo: formData.get("weekNo"),
    conductedOn: formData.get("conductedOn"),
    windowStart: formData.get("windowStart"),
    windowEnd: formData.get("windowEnd"),
    summary: formData.get("summary") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the review details.", success: null };
  }
  const { clientId, weekNo, conductedOn, windowStart, windowEnd, summary } = parsed.data;

  const user = await requireClinicalAccess(clientId);
  if (!user) return { error: "You do not have access to this client.", success: null };

  const admin = getAdminClient();
  const { data: clash } = await admin
    .from("weekly_reviews")
    .select("id")
    .eq("client_id", clientId)
    .eq("week_no", weekNo)
    .maybeSingle();
  if (clash) {
    return {
      error: `Week ${weekNo} already has a review. Add your findings to it, or use a different week number.`,
      success: null,
    };
  }

  const { data: review, error } = await admin
    .from("weekly_reviews")
    .insert({
      client_id: clientId,
      week_no: weekNo,
      window_start: windowStart,
      window_end: windowEnd,
      // issued_by / issued_at record who conducted the review and when it was
      // actually conducted, which may be earlier than today.
      issued_by: user.id,
      issued_at: new Date(`${conductedOn}T12:00:00Z`).toISOString(),
      summary: summary ?? null,
    })
    .select("id")
    .single();
  if (error || !review) {
    return { error: "Could not open the review. Try again.", success: null };
  }

  // The programme clock follows the review; the first week is the baseline.
  const { data: client } = await admin
    .from("clients")
    .select("baseline_week, programme_week")
    .eq("id", clientId)
    .maybeSingle();
  await admin
    .from("clients")
    .update({
      programme_week: Math.max(weekNo, client?.programme_week ?? 0),
      baseline_week: client?.baseline_week ?? weekNo,
    })
    .eq("id", clientId);

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "weekly_review.opened",
    entity: "weekly_reviews",
    entity_id: review.id,
    meta: {
      client_id: clientId,
      week_no: weekNo,
      conducted_on: conductedOn,
      window_start: windowStart,
      window_end: windowEnd,
    },
  });

  revalidatePath("/console");
  revalidatePath("/console/review");
  return {
    error: null,
    success: `Week ${weekNo} is open. Record the readings and actions below, then the consultant signs it off.`,
  };
}

/**
 * Activate, pause or discharge a client's record. Any clinical role on their
 * care team can change it; the reason is required for anything other than
 * activating and is written to the audit trail, not to the client's row (a
 * client can read their own row, and the team's reasoning is clinical).
 *
 * Status is not an access control: a paused or discharged client keeps their
 * sign-in and their own data. It changes what the surfaces say. Pausing shows
 * the client a calm, protective banner on their home; discharging closes the
 * programme off.
 */
export async function setClientStatus(
  _prev: EntryState,
  formData: FormData,
): Promise<EntryState> {
  const parsed = clientStatusSchema.safeParse({
    clientId: formData.get("clientId"),
    status: formData.get("status"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the status change.", success: null };
  }
  const { clientId, status, note } = parsed.data;

  const user = await requireClinicalAccess(clientId);
  if (!user) return { error: "You do not have access to this client.", success: null };

  const admin = getAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id, status")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return { error: "That client could not be found.", success: null };
  if (client.status === status) {
    return { error: `This record is already ${STATUS_WORDS[status]}.`, success: null };
  }

  const { error } = await admin
    .from("clients")
    .update({
      status,
      status_changed_at: new Date().toISOString(),
      status_changed_by: user.id,
    })
    .eq("id", clientId);
  if (error) return { error: "Could not change the status. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: `client_status.${status}`,
    entity: "clients",
    entity_id: clientId,
    meta: { client_id: clientId, from: client.status, to: status, note: note ?? null },
  });

  revalidatePath("/console");
  revalidatePath("/console/review");
  revalidatePath("/app");
  return {
    error: null,
    success:
      status === "active"
        ? "Record activated. The programme is running again."
        : status === "paused"
          ? "Record paused. The client sees a calm note that their programme is on hold."
          : "Record discharged. The programme is closed off.",
  };
}

/**
 * Record a metric reading against the client's latest weekly review, or
 * correct the most recent entry after a faulty input. Scores recompute.
 */
export async function recordMetric(_prev: EntryState, formData: FormData): Promise<EntryState> {
  const parsed = metricSchema.safeParse({
    clientId: formData.get("clientId"),
    reviewId: formData.get("reviewId") || undefined,
    metricCode: formData.get("metricCode"),
    value: formData.get("value"),
    recordedAt: formData.get("recordedAt") || undefined,
    correction: formData.get("correction") === "on",
  });
  if (!parsed.success) return { error: "Enter a number for the reading.", success: null };
  const { clientId, metricCode, value, correction } = parsed.data;

  const recordedAt = parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : new Date();
  if (Number.isNaN(recordedAt.getTime())) {
    return { error: "Check the date and time of the reading.", success: null };
  }

  const user = await requireClinicalAccess(clientId);
  if (!user) return { error: "You do not have access to this client.", success: null };

  const admin = getAdminClient();
  const review = await resolveReview(admin, clientId, parsed.data.reviewId);
  if (!review) return { error: NO_REVIEW_ERROR, success: null };

  const { data: metric } = await admin
    .from("metrics_catalog")
    .select("code, name")
    .eq("code", metricCode)
    .maybeSingle();
  if (!metric) return { error: "Unknown metric.", success: null };

  const target = await effectiveTarget(admin, clientId, metricCode);
  const status = statusFor(target, value);

  const { data: existing } = await admin
    .from("metric_readings")
    .select("id, current, previous, history")
    .eq("review_id", review.id)
    .eq("metric_code", metricCode)
    .maybeSingle();

  if (correction && !existing) {
    return { error: "There is no entry to correct for this metric yet.", success: null };
  }

  if (existing) {
    const history = Array.isArray(existing.history) ? (existing.history as number[]) : [];
    // A correction replaces the most recent entry; a new reading appends.
    const nextHistory = correction ? [...history.slice(0, -1), value] : [...history, value];
    const previous = correction ? existing.previous : existing.current;
    const { error } = await admin
      .from("metric_readings")
      .update({
        previous,
        current: value,
        delta: previous != null ? Number((value - previous).toFixed(2)) : null,
        status,
        history: nextHistory.slice(-12),
        recorded_at: recordedAt.toISOString(),
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
      recorded_at: recordedAt.toISOString(),
    });
    if (error) return { error: "Could not save the reading. Try again.", success: null };
  }

  await recomputeReviewScores(admin, review.id, clientId);

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: correction ? "metric_reading.corrected" : "metric_reading.recorded",
    entity: "metric_readings",
    entity_id: review.id,
    meta: {
      client_id: clientId,
      metric_code: metricCode,
      value,
      status,
      week_no: review.week_no,
      recorded_at: recordedAt.toISOString(),
    },
  });

  revalidatePath("/console");
  return {
    error: null,
    success: `${metric.name} ${correction ? "corrected" : "recorded"}: ${value} (${status.replace("_", " ")}). Scores updated.`,
  };
}

/** Add an action or safety flag to the client's latest weekly review. */
export async function addAction(_prev: EntryState, formData: FormData): Promise<EntryState> {
  const parsed = actionSchema.safeParse({
    clientId: formData.get("clientId"),
    reviewId: formData.get("reviewId") || undefined,
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
  const review = await resolveReview(admin, clientId, parsed.data.reviewId);
  if (!review) return { error: NO_REVIEW_ERROR, success: null };

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

/**
 * Set a per-client goal for one metric (based on health status). The latest
 * reading is reassessed against the new goal and scores recompute.
 */
export async function setMetricGoal(_prev: EntryState, formData: FormData): Promise<EntryState> {
  const parsed = goalSchema.safeParse({
    clientId: formData.get("clientId"),
    metricCode: formData.get("metricCode"),
    kind: formData.get("kind"),
    value: formData.get("value") || undefined,
    min: formData.get("min") || undefined,
    max: formData.get("max") || undefined,
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the goal values.",
      success: null,
    };
  }
  const { clientId, metricCode, kind } = parsed.data;
  const target: Target =
    kind === "range"
      ? { kind, min: parsed.data.min!, max: parsed.data.max! }
      : { kind, value: parsed.data.value! };

  const user = await requireClinicalAccess(clientId);
  if (!user) return { error: "You do not have access to this client.", success: null };

  const admin = getAdminClient();
  const { data: metric } = await admin
    .from("metrics_catalog")
    .select("code, name")
    .eq("code", metricCode)
    .maybeSingle();
  if (!metric) return { error: "Unknown metric.", success: null };

  const { error } = await admin.from("client_metric_targets").upsert({
    client_id: clientId,
    metric_code: metricCode,
    target_def: target,
    set_by: user.id,
    set_at: new Date().toISOString(),
  });
  if (error) return { error: "Could not save the goal. Try again.", success: null };

  // Reassess the latest reading against the new goal, then recompute scores.
  const review = await latestReview(admin, clientId);
  if (review) {
    const { data: reading } = await admin
      .from("metric_readings")
      .select("id, current")
      .eq("review_id", review.id)
      .eq("metric_code", metricCode)
      .maybeSingle();
    if (reading?.current != null) {
      await admin
        .from("metric_readings")
        .update({ status: statusFor(target, reading.current) })
        .eq("id", reading.id);
    }
    await recomputeReviewScores(admin, review.id, clientId);
  }

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "metric_goal.set",
    entity: "client_metric_targets",
    entity_id: clientId,
    meta: { client_id: clientId, metric_code: metricCode, target },
  });

  revalidatePath("/console");
  return { error: null, success: `Goal updated for ${metric.name}. Scores reassessed.` };
}

/**
 * Audited sign-off of a weekly review (Phase 2 gate). Consultant or admin
 * only: signing off records who reviewed the week and when, on the review
 * itself and in the append-only audit trail. A signed review stays signed;
 * there is no un-sign.
 */
export async function signOffReview(_prev: EntryState, formData: FormData): Promise<EntryState> {
  const parsed = signOffSchema.safeParse({
    clientId: formData.get("clientId"),
    reviewId: formData.get("reviewId"),
    confirmed: formData.get("confirmed") === "on" ? true : undefined,
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the sign-off details.",
      success: null,
    };
  }
  const { clientId, reviewId } = parsed.data;

  const user = await requireClinicalAccess(clientId);
  if (!user) return { error: "You do not have access to this client.", success: null };

  const role = user.app_metadata?.role;
  if (role !== "consultant" && role !== "admin") {
    return { error: "Only the consultant signs off a weekly review.", success: null };
  }

  const admin = getAdminClient();
  const { data: review } = await admin
    .from("weekly_reviews")
    .select("id, client_id, week_no, signed_at")
    .eq("id", reviewId)
    .maybeSingle();
  if (!review || review.client_id !== clientId) {
    return { error: "That review could not be found.", success: null };
  }
  if (review.signed_at != null) {
    return { error: "This review is already signed off.", success: null };
  }

  const signedAt = new Date().toISOString();
  const { error } = await admin
    .from("weekly_reviews")
    .update({ signed_by: user.id, signed_at: signedAt })
    .eq("id", reviewId)
    .is("signed_at", null);
  if (error) return { error: "Could not record the sign-off. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "weekly_review.signed_off",
    entity: "weekly_reviews",
    entity_id: reviewId,
    meta: { client_id: clientId, week_no: review.week_no, signed_at: signedAt },
  });

  revalidatePath("/console");
  return { error: null, success: `Week ${review.week_no} signed off.` };
}
