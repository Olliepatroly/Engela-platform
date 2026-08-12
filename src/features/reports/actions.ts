"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { isClinical, isRole } from "@/lib/roles";
import { MAX_REPORT_BYTES, REPORT_KINDS, REPORT_MIME_TYPES } from "./constants";

export type ReportState = { error: string | null; success: string | null };

const uploadSchema = z.object({
  clientId: z.string().uuid().optional(),
  reviewId: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Give the report a title so the team can find it.").max(160),
  kind: z.enum(REPORT_KINDS),
  takenOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Check the date the report is from.")
    .optional(),
  note: z.string().trim().max(2000).optional(),
  shareWithTeam: z.boolean(),
  shareWithClient: z.boolean(),
  clientSafeConfirmed: z.boolean(),
});

const sharingSchema = z.object({
  reportId: z.string().uuid(),
  share: z.enum(["team-on", "team-off", "client-on", "client-off"]),
  clientSafeConfirmed: z.boolean(),
});

type Uploader =
  | { role: "clinician"; userId: string; clientId: string }
  | { role: "client"; userId: string; clientId: string };

/**
 * Who is uploading, and for whom. A clinical account may upload for any client
 * their session can read (RLS: consented care team). A client may only ever
 * upload against their own record; the clientId on the form is ignored for
 * them so it cannot be pointed at anyone else.
 */
async function resolveUploader(clientId?: string): Promise<Uploader | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const role = user.app_metadata?.role;
  if (!isRole(role)) return null;

  if (role === "client") {
    const { data: own } = await getAdminClient()
      .from("clients")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!own) return null;
    return { role: "client", userId: user.id, clientId: own.id };
  }

  if (!isClinical(role) || !clientId) return null;
  // The session's own RLS read is the authorisation check.
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return null;
  return { role: "clinician", userId: user.id, clientId: client.id };
}

function extensionFor(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  return "heic";
}

/**
 * Submit a report or test result: a consultant's PDF from a review conducted
 * in clinic, a bloods or DEXA result, a clinic letter, or a photo of a test
 * the client had done elsewhere. Anyone on the care team can submit one, and
 * so can the client.
 *
 * Consent runs in both directions and is stored per report:
 *   * A clinical upload stays with the clinical team. It reaches the client
 *     app only if the uploader ticks the share box AND confirms the document
 *     holds no raw lab values, disease markers or MRD results (CLAUDE.md §2
 *     rule 2 — the client app never shows those).
 *   * A client's own upload is theirs. They choose whether their care team
 *     sees it, and can withdraw that later.
 *
 * The file goes to the private clinical-reports bucket through the service
 * role; there is no direct access to it from either browser.
 */
export async function uploadReport(_prev: ReportState, formData: FormData): Promise<ReportState> {
  const parsed = uploadSchema.safeParse({
    clientId: (formData.get("clientId") as string | null) || undefined,
    reviewId: (formData.get("reviewId") as string | null) || undefined,
    title: formData.get("title"),
    kind: formData.get("kind"),
    takenOn: (formData.get("takenOn") as string | null) || undefined,
    note: (formData.get("note") as string | null) || undefined,
    shareWithTeam: formData.get("shareWithTeam") === "on",
    shareWithClient: formData.get("shareWithClient") === "on",
    clientSafeConfirmed: formData.get("clientSafeConfirmed") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the report details.", success: null };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose the file to submit.", success: null };
  }
  if (file.size > MAX_REPORT_BYTES) {
    return { error: "That file is over 10 MB. Compress it or split it up.", success: null };
  }
  const mime = file.type.split(";")[0] ?? "";
  if (!REPORT_MIME_TYPES.includes(mime as (typeof REPORT_MIME_TYPES)[number])) {
    return { error: "Submit a PDF or a photo (JPEG, PNG or HEIC).", success: null };
  }

  const uploader = await resolveUploader(parsed.data.clientId);
  if (!uploader) return { error: "You do not have access to this client.", success: null };

  // A review can only be attached if it belongs to this client.
  let reviewId: string | null = null;
  if (parsed.data.reviewId) {
    const admin = getAdminClient();
    const { data: review } = await admin
      .from("weekly_reviews")
      .select("id, client_id")
      .eq("id", parsed.data.reviewId)
      .maybeSingle();
    reviewId = review && review.client_id === uploader.clientId ? review.id : null;
  }

  // Load-bearing: a clinical upload reaches the client app only on an explicit,
  // confirmed share. A client's own upload is always theirs to see.
  const visibleToClient =
    uploader.role === "client"
      ? true
      : parsed.data.shareWithClient && parsed.data.clientSafeConfirmed;
  const sharedWithTeam = uploader.role === "client" ? parsed.data.shareWithTeam : true;

  if (
    uploader.role === "clinician" &&
    parsed.data.shareWithClient &&
    !parsed.data.clientSafeConfirmed
  ) {
    return {
      error:
        "To share a document with the client, confirm it holds no raw lab values, disease markers or MRD results.",
      success: null,
    };
  }

  const admin = getAdminClient();
  const storagePath = `${uploader.clientId}/${crypto.randomUUID()}.${extensionFor(mime)}`;
  const { error: uploadError } = await admin.storage
    .from("clinical-reports")
    .upload(storagePath, await file.arrayBuffer(), { contentType: mime });
  if (uploadError) {
    return { error: "Could not save the file. Try again.", success: null };
  }

  const { data: inserted, error } = await admin
    .from("client_reports")
    .insert({
      client_id: uploader.clientId,
      review_id: reviewId,
      title: parsed.data.title,
      kind: parsed.data.kind,
      taken_on: parsed.data.takenOn ?? null,
      note: parsed.data.note ?? null,
      storage_path: storagePath,
      mime_type: mime,
      size_bytes: file.size,
      uploaded_by: uploader.userId,
      uploaded_role: uploader.role,
      visible_to_client: visibleToClient,
      shared_with_team: sharedWithTeam,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    // Do not leave an orphan file behind if the record could not be written.
    await admin.storage.from("clinical-reports").remove([storagePath]);
    return { error: "Could not save the report. Try again.", success: null };
  }

  await admin.from("audit_log").insert({
    actor_id: uploader.userId,
    action: "report.submitted",
    entity: "client_reports",
    entity_id: inserted.id,
    meta: {
      client_id: uploader.clientId,
      kind: parsed.data.kind,
      uploaded_role: uploader.role,
      review_id: reviewId,
      client_visible: visibleToClient,
      shared_with_team: sharedWithTeam,
    },
  });

  revalidatePath("/console/review");
  revalidatePath("/app/account");
  return {
    error: null,
    success:
      uploader.role === "client"
        ? sharedWithTeam
          ? "Saved and shared with your care team."
          : "Saved. Only you can see it until you choose to share it."
        : visibleToClient
          ? "Report saved and shared with the client."
          : "Report saved for the clinical team.",
  };
}

/**
 * Change who a report is shared with. A client controls whether their care
 * team sees a report they submitted; a clinician controls whether a clinical
 * report is shared with the client. Neither can widen the other's choice, and
 * every change is audited.
 */
export async function setReportSharing(
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const parsed = sharingSchema.safeParse({
    reportId: formData.get("reportId"),
    share: formData.get("share"),
    clientSafeConfirmed: formData.get("clientSafeConfirmed") === "on",
  });
  if (!parsed.success) return { error: "Unknown report.", success: null };
  const { reportId, share } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;
  if (!user || !isRole(role)) return { error: "Sign in again to make that change.", success: null };

  // RLS decides what the caller can even see; the checks below decide what
  // they may change about it.
  const { data: report } = await supabase
    .from("client_reports")
    .select("id, client_id, uploaded_by, uploaded_role")
    .eq("id", reportId)
    .maybeSingle();
  if (!report) return { error: "Unknown report.", success: null };

  const isTeamChange = share === "team-on" || share === "team-off";
  if (isTeamChange) {
    // Only the client themselves decides whether their team sees their upload.
    if (role !== "client" || report.uploaded_role !== "client" || report.uploaded_by !== user.id) {
      return { error: "Only the person who submitted this can change that.", success: null };
    }
  } else if (!isClinical(role)) {
    return { error: "Only the clinical team can change that.", success: null };
  } else if (share === "client-on" && !parsed.data.clientSafeConfirmed) {
    // Same gate as the upload form: the client app never shows raw results.
    return {
      error:
        "To share a document with the client, confirm it holds no raw lab values, disease markers or MRD results.",
      success: null,
    };
  }

  const patch = isTeamChange
    ? { shared_with_team: share === "team-on" }
    : { visible_to_client: share === "client-on" };

  const admin = getAdminClient();
  const { error } = await admin.from("client_reports").update(patch).eq("id", reportId);
  if (error) return { error: "Could not change the sharing. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: share.endsWith("-on") ? "report.sharing_granted" : "report.sharing_withdrawn",
    entity: "client_reports",
    entity_id: reportId,
    meta: { client_id: report.client_id, share },
  });

  revalidatePath("/console/review");
  revalidatePath("/app/account");
  return {
    error: null,
    success: share.endsWith("-on") ? "Sharing turned on." : "Sharing withdrawn.",
  };
}
