"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireClinicalAccess } from "./access";
import { reviewWindow } from "./review-window";
import type { EntryState } from "./entry-actions";

/* ── Shared helpers ───────────────────────────────────────────────────── */

type AdminClient = ReturnType<typeof getAdminClient>;

const MAX_REPORT_BYTES = 10 * 1024 * 1024; // matches the bucket's file_size_limit

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Check the date.");

/** The client's latest review week, so a new one lands on the next week. */
async function nextWeekNo(admin: AdminClient, clientId: string): Promise<number> {
  const { data: latest } = await admin
    .from("weekly_reviews")
    .select("week_no")
    .eq("client_id", clientId)
    .order("week_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest) return latest.week_no + 1;

  const { data: client } = await admin
    .from("clients")
    .select("programme_week")
    .eq("id", clientId)
    .maybeSingle();
  return client?.programme_week ?? 1;
}

/**
 * The clinical context strip a new review starts with, taken from the client
 * record. CLINICAL-ONLY (it is the field that later holds disease markers), so
 * it is never read by the client-safe projection.
 */
async function seedContext(
  admin: AdminClient,
  clientId: string,
): Promise<Record<string, string>> {
  const { data: client } = await admin
    .from("clients")
    .select("diagnosis, treatment_phase")
    .eq("id", clientId)
    .maybeSingle();
  const context: Record<string, string> = {};
  if (client?.diagnosis) context.diagnosis = client.diagnosis;
  if (client?.treatment_phase) context.treatment_phase = client.treatment_phase;
  return context;
}

/** Keep the roster and the client app's week in step with the latest review. */
async function syncProgrammeWeek(admin: AdminClient, clientId: string, weekNo: number) {
  const { data: client } = await admin
    .from("clients")
    .select("programme_week")
    .eq("id", clientId)
    .maybeSingle();
  if (client && (client.programme_week == null || client.programme_week < weekNo)) {
    await admin.from("clients").update({ programme_week: weekNo }).eq("id", clientId);
  }
}

function revalidateConsole() {
  revalidatePath("/console");
  revalidatePath("/console/review");
}

/**
 * Validate an uploaded report and hand back its bytes. PDFs only, checked by
 * declared type AND by the file's own `%PDF-` signature, so a renamed file
 * cannot slip into the clinical document store.
 */
async function readPdf(
  file: File,
): Promise<{ error: string } | { error: null; bytes: ArrayBuffer }> {
  if (file.size === 0) return { error: "That file is empty. Choose the PDF again." };
  if (file.size > MAX_REPORT_BYTES) {
    return { error: "That PDF is larger than 10 MB. Upload a smaller file." };
  }
  const declared = (file.type ?? "").split(";")[0]?.trim().toLowerCase();
  if (declared !== "application/pdf") {
    return { error: "Reports must be PDF files." };
  }
  const bytes = await file.arrayBuffer();
  const signature = new TextDecoder().decode(new Uint8Array(bytes.slice(0, 5)));
  if (signature !== "%PDF-") {
    return { error: "That file is not a readable PDF. Export it again and retry." };
  }
  return { error: null, bytes };
}

const reportKinds = ["consultant_review", "bloods", "dexa", "clinic_letter", "other"] as const;

/**
 * Store an already-validated PDF in the private bucket and record it against
 * the client. Callers run `readPdf` first so nothing is written to the record
 * before the document is known to be a real PDF.
 */
async function storeReport(
  admin: AdminClient,
  input: {
    clientId: string;
    reviewId: string | null;
    kind: (typeof reportKinds)[number];
    title: string;
    note?: string | null;
    conductedOn?: string | null;
    conductedByName?: string | null;
    uploadedBy: string;
    file: File;
    bytes: ArrayBuffer;
  },
): Promise<{ error: string } | { error: null; reportId: string; storagePath: string }> {
  const storagePath = `${input.clientId}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await admin.storage
    .from("clinical-reports")
    .upload(storagePath, input.bytes, { contentType: "application/pdf" });
  if (uploadError) return { error: "Could not upload the report. Try again." };

  const { data: inserted, error } = await admin
    .from("review_reports")
    .insert({
      client_id: input.clientId,
      review_id: input.reviewId,
      kind: input.kind,
      title: input.title,
      note: input.note || null,
      storage_path: storagePath,
      file_name: input.file.name.slice(0, 200),
      file_size: input.file.size,
      conducted_on: input.conductedOn || null,
      conducted_by_name: input.conductedByName || null,
      uploaded_by: input.uploadedBy,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    // Do not leave an orphan object behind in the bucket.
    await admin.storage.from("clinical-reports").remove([storagePath]);
    return { error: "Could not save the report. Try again." };
  }

  return { error: null, reportId: inserted.id, storagePath };
}

/* ── Opening a review ─────────────────────────────────────────────────── */

const openReviewSchema = z.object({
  clientId: z.string().uuid(),
  weekNo: z.coerce.number().int().min(1, "Week numbers start at 1.").max(520).optional(),
  windowStart: isoDate.optional(),
});

/**
 * Open (book) a weekly review for a client. This is the step that was missing:
 * without a review row there is nothing for readings, actions, goals or
 * sign-off to attach to, so a newly invited client was a dead end.
 *
 * ANY clinical role on the client's care team may open one — conducting a
 * review is the team's work. Sign-off remains the consultant's act
 * (`signOffReview`), which is what makes the week clinically final.
 */
export async function openReview(_prev: EntryState, formData: FormData): Promise<EntryState> {
  const parsed = openReviewSchema.safeParse({
    clientId: formData.get("clientId"),
    weekNo: formData.get("weekNo") || undefined,
    windowStart: formData.get("windowStart") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the review details.", success: null };
  }
  const { clientId } = parsed.data;

  const user = await requireClinicalAccess(clientId);
  if (!user) return { error: "You do not have access to this client.", success: null };

  const admin = getAdminClient();
  const weekNo = parsed.data.weekNo ?? (await nextWeekNo(admin, clientId));
  const { windowStart, windowEnd } = reviewWindow(parsed.data.windowStart ?? todayIso());

  const { data: clash } = await admin
    .from("weekly_reviews")
    .select("id")
    .eq("client_id", clientId)
    .eq("week_no", weekNo)
    .maybeSingle();
  if (clash) {
    return { error: `Week ${weekNo} is already open for this client.`, success: null };
  }

  const now = new Date().toISOString();
  const { data: created, error } = await admin
    .from("weekly_reviews")
    .insert({
      client_id: clientId,
      week_no: weekNo,
      window_start: windowStart,
      window_end: windowEnd,
      context: await seedContext(admin, clientId),
      source: "console",
      issued_by: user.id,
      issued_at: now,
    })
    .select("id")
    .single();
  if (error || !created) {
    return { error: "Could not open the review. Try again.", success: null };
  }

  await syncProgrammeWeek(admin, clientId, weekNo);

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "weekly_review.opened",
    entity: "weekly_reviews",
    entity_id: created.id,
    meta: { client_id: clientId, week_no: weekNo, window_start: windowStart, source: "console" },
  });

  revalidateConsole();
  return {
    error: null,
    success: `Week ${weekNo} is open. Record readings and actions below, then the consultant signs it off.`,
  };
}

/* ── Submitting a review conducted earlier ────────────────────────────── */

const conductedReviewSchema = z.object({
  clientId: z.string().uuid(),
  weekNo: z.coerce.number().int().min(1).max(520).optional(),
  conductedOn: isoDate,
  conductedByName: z.string().trim().max(120).optional(),
  summary: z
    .string()
    .trim()
    .min(20, "Write a short clinical summary so the team can follow the review.")
    .max(5000),
  reportTitle: z.string().trim().max(160).optional(),
});

/**
 * Record a review that was conducted earlier, away from the console — the
 * usual case being a consultant's clinic review written up as a PDF. Creates
 * (or completes) the week's review with the summary and attribution, and files
 * the PDF in the clinical document store when one is attached.
 *
 * A signed week is final: it is never rewritten here. Use the reports form to
 * attach a document to a week that is already signed off.
 */
export async function submitConductedReview(
  _prev: EntryState,
  formData: FormData,
): Promise<EntryState> {
  const parsed = conductedReviewSchema.safeParse({
    clientId: formData.get("clientId"),
    weekNo: formData.get("weekNo") || undefined,
    conductedOn: formData.get("conductedOn"),
    conductedByName: formData.get("conductedByName") || undefined,
    summary: formData.get("summary"),
    reportTitle: formData.get("reportTitle") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the review details.", success: null };
  }
  const { clientId, conductedOn, summary } = parsed.data;

  if (conductedOn > todayIso()) {
    return { error: "A review cannot have been conducted in the future.", success: null };
  }

  const user = await requireClinicalAccess(clientId);
  if (!user) return { error: "You do not have access to this client.", success: null };

  // Validate the attachment before anything is written: a bad PDF must not
  // leave a half-recorded review behind.
  const file = formData.get("report");
  const hasReport = file instanceof File && file.size > 0;
  let reportBytes: ArrayBuffer | null = null;
  if (hasReport) {
    const check = await readPdf(file);
    if (check.error != null) return { error: check.error, success: null };
    reportBytes = check.bytes;
  }

  const admin = getAdminClient();
  const weekNo = parsed.data.weekNo ?? (await nextWeekNo(admin, clientId));
  const conductedAt = new Date(`${conductedOn}T12:00:00Z`).toISOString();

  const { data: existing } = await admin
    .from("weekly_reviews")
    .select("id, signed_at")
    .eq("client_id", clientId)
    .eq("week_no", weekNo)
    .maybeSingle();

  if (existing?.signed_at) {
    return {
      error: `Week ${weekNo} is already signed off, so it cannot be rewritten. Attach the document under Reports, or submit the next week.`,
      success: null,
    };
  }

  let reviewId: string;
  if (existing) {
    const { error } = await admin
      .from("weekly_reviews")
      .update({
        source: "uploaded",
        summary,
        conducted_at: conductedAt,
        conducted_by: user.id,
      })
      .eq("id", existing.id);
    if (error) return { error: "Could not save the review. Try again.", success: null };
    reviewId = existing.id;
  } else {
    const { windowStart, windowEnd } = reviewWindow(conductedOn);
    const { data: created, error } = await admin
      .from("weekly_reviews")
      .insert({
        client_id: clientId,
        week_no: weekNo,
        window_start: windowStart,
        window_end: windowEnd,
        context: await seedContext(admin, clientId),
        source: "uploaded",
        summary,
        conducted_at: conductedAt,
        conducted_by: user.id,
        issued_by: user.id,
        issued_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !created) {
      return { error: "Could not save the review. Try again.", success: null };
    }
    reviewId = created.id;
  }

  let reportFiled = false;
  if (hasReport && reportBytes) {
    const stored = await storeReport(admin, {
      clientId,
      reviewId,
      kind: "consultant_review",
      title: parsed.data.reportTitle || `Week ${weekNo} review report`,
      conductedOn,
      conductedByName: parsed.data.conductedByName,
      uploadedBy: user.id,
      file,
      bytes: reportBytes,
    });
    if (stored.error != null) return { error: stored.error, success: null };
    reportFiled = true;

    await admin.from("audit_log").insert({
      actor_id: user.id,
      action: "review_report.uploaded",
      entity: "review_reports",
      entity_id: stored.reportId,
      meta: { client_id: clientId, week_no: weekNo, kind: "consultant_review" },
    });
  }

  await syncProgrammeWeek(admin, clientId, weekNo);

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "weekly_review.conducted",
    entity: "weekly_reviews",
    entity_id: reviewId,
    meta: {
      client_id: clientId,
      week_no: weekNo,
      conducted_at: conductedAt,
      conducted_by_name: parsed.data.conductedByName ?? null,
      report_attached: reportFiled,
      source: "uploaded",
    },
  });

  revalidateConsole();
  return {
    error: null,
    success: `Week ${weekNo} recorded as conducted on ${conductedOn}${
      reportFiled ? ", with the report filed" : ""
    }. The consultant can sign it off below.`,
  };
}

/* ── Reports ──────────────────────────────────────────────────────────── */

const uploadReportSchema = z.object({
  clientId: z.string().uuid(),
  reviewId: z.string().uuid().optional(),
  kind: z.enum(reportKinds),
  title: z.string().trim().min(3, "Give the report a title the team will recognise.").max(160),
  note: z.string().trim().max(1000).optional(),
  conductedOn: isoDate.optional(),
  conductedByName: z.string().trim().max(120).optional(),
});

/**
 * File a clinical PDF (consultant review, bloods, DEXA, clinic letter) against
 * a client, optionally tied to the week on screen. Clinical team only: these
 * documents carry raw labs and disease markers and are never client-readable.
 */
export async function uploadReport(_prev: EntryState, formData: FormData): Promise<EntryState> {
  const parsed = uploadReportSchema.safeParse({
    clientId: formData.get("clientId"),
    reviewId: formData.get("reviewId") || undefined,
    kind: formData.get("kind"),
    title: formData.get("title"),
    note: formData.get("note") || undefined,
    conductedOn: formData.get("conductedOn") || undefined,
    conductedByName: formData.get("conductedByName") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the report details.", success: null };
  }
  const { clientId } = parsed.data;

  const file = formData.get("report");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF to upload.", success: null };
  }

  const user = await requireClinicalAccess(clientId);
  if (!user) return { error: "You do not have access to this client.", success: null };

  const pdf = await readPdf(file);
  if (pdf.error != null) return { error: pdf.error, success: null };

  const admin = getAdminClient();

  // A review id from the form is only trusted once it is confirmed to belong
  // to this client.
  let reviewId: string | null = null;
  if (parsed.data.reviewId) {
    const { data: review } = await admin
      .from("weekly_reviews")
      .select("id, client_id")
      .eq("id", parsed.data.reviewId)
      .maybeSingle();
    if (review?.client_id === clientId) reviewId = review.id;
  }

  const stored = await storeReport(admin, {
    clientId,
    reviewId,
    kind: parsed.data.kind,
    title: parsed.data.title,
    note: parsed.data.note,
    conductedOn: parsed.data.conductedOn,
    conductedByName: parsed.data.conductedByName,
    uploadedBy: user.id,
    file,
    bytes: pdf.bytes,
  });
  if (stored.error != null) return { error: stored.error, success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "review_report.uploaded",
    entity: "review_reports",
    entity_id: stored.reportId,
    meta: { client_id: clientId, kind: parsed.data.kind, review_id: reviewId },
  });

  revalidateConsole();
  return { error: null, success: `${parsed.data.title} filed. The care team can open it below.` };
}

/* ── Account status ───────────────────────────────────────────────────── */

const CLIENT_STATUSES = ["active", "paused", "discharged"] as const;

const clientStatusSchema = z.object({
  clientId: z.string().uuid(),
  status: z.enum(CLIENT_STATUSES),
});

const STATUS_MESSAGES: Record<(typeof CLIENT_STATUSES)[number], string> = {
  active: "Account activated. The client app is live for them.",
  paused: "Programme paused. The client sees a protective message, not an alarm.",
  discharged: "Client discharged. Their record stays in the audit trail.",
};

/**
 * Activate, pause or discharge a client's programme. Activating is what turns
 * a newly invited account into a live one; pausing shows the client the calm
 * "your programme is paused" state rather than an empty app. Audited.
 */
export async function setClientStatus(
  _prev: EntryState,
  formData: FormData,
): Promise<EntryState> {
  const parsed = clientStatusSchema.safeParse({
    clientId: formData.get("clientId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Choose a status for this account.", success: null };
  const { clientId, status } = parsed.data;

  const user = await requireClinicalAccess(clientId);
  if (!user) return { error: "You do not have access to this client.", success: null };

  const admin = getAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("status")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return { error: "That client could not be found.", success: null };
  if (client.status === status) {
    return { error: null, success: `This account is already ${status}.` };
  }

  const { error } = await admin.from("clients").update({ status }).eq("id", clientId);
  if (error) return { error: "Could not update the account. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "client.status_changed",
    entity: "clients",
    entity_id: clientId,
    meta: { client_id: clientId, from: client.status, to: status },
  });

  revalidateConsole();
  revalidatePath("/app");
  return { error: null, success: STATUS_MESSAGES[status] };
}
