import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { REPORT_KIND_LABELS, type ReportKind } from "./constants";

export type ReportVM = {
  id: string;
  title: string;
  kind: ReportKind;
  kindLabel: string;
  takenOn: string | null;
  note: string | null;
  weekNo: number | null;
  submittedByName: string;
  submittedRole: "clinician" | "client";
  submittedAt: string;
  sizeText: string;
  isPdf: boolean;
  visibleToClient: boolean;
  sharedWithTeam: boolean;
  /** Short-lived signed URL; the bucket itself has no public access. */
  fileUrl: string | null;
};

const SELECT = `id, title, kind, taken_on, note, storage_path, mime_type, size_bytes,
  uploaded_by, uploaded_role, created_at, visible_to_client, shared_with_team,
  uploader:profiles!client_reports_uploaded_by_fkey(full_name),
  weekly_reviews(week_no)`;

type ReportRow = {
  id: string;
  title: string;
  kind: string;
  taken_on: string | null;
  note: string | null;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  uploaded_role: string;
  created_at: string;
  visible_to_client: boolean;
  shared_with_team: boolean;
  uploader: { full_name: string } | null;
  weekly_reviews: { week_no: number } | null;
};

function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Signed download URLs are minted with the service role, but only ever for
 * rows RLS already let the caller read: the query runs on the caller's own
 * session, so an unshared report never reaches this point.
 */
async function toViewModels(rows: ReportRow[]): Promise<ReportVM[]> {
  const admin = getAdminClient();

  // Clients cannot read clinicians' profiles directly (0007 keeps that narrow),
  // so the embedded name comes back empty on the client app. These rows already
  // passed RLS for this caller, and the client is entitled to know which of
  // their team shared a document with them, so fill the gap by id.
  const missingNames = [...new Set(rows.filter((r) => !r.uploader).map((r) => r.uploaded_by))];
  const nameById = new Map<string, string>();
  if (missingNames.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", missingNames);
    for (const profile of profiles ?? []) nameById.set(profile.id, profile.full_name);
  }

  const reports: ReportVM[] = [];
  for (const row of rows) {
    const { data: signed } = await admin.storage
      .from("clinical-reports")
      .createSignedUrl(row.storage_path, 60 * 10);
    reports.push({
      id: row.id,
      title: row.title,
      kind: row.kind as ReportKind,
      kindLabel: REPORT_KIND_LABELS[row.kind as ReportKind] ?? "Document",
      takenOn: row.taken_on,
      note: row.note,
      weekNo: row.weekly_reviews?.week_no ?? null,
      submittedByName: row.uploader?.full_name ?? nameById.get(row.uploaded_by) ?? "Your care team",
      submittedRole: row.uploaded_role === "client" ? "client" : "clinician",
      submittedAt: row.created_at,
      sizeText: sizeText(row.size_bytes),
      isPdf: row.mime_type === "application/pdf",
      visibleToClient: row.visible_to_client,
      sharedWithTeam: row.shared_with_team,
      fileUrl: signed?.signedUrl ?? null,
    });
  }
  return reports;
}

/** Reports on one client's record, newest first (RLS: consented care team). */
export async function getClientReports(clientId: string): Promise<ReportVM[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_reports")
    .select(SELECT)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return toViewModels(data as unknown as ReportRow[]);
}

/**
 * The signed-in client's own reports: everything they submitted, plus anything
 * the clinical team has explicitly shared with them. RLS does the gating.
 */
export async function getOwnReports(): Promise<ReportVM[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_reports")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return toViewModels(data as unknown as ReportRow[]);
}
