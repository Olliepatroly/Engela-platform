import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Clinical flags — console-side reads. All list/detail reads go through the
 * RLS server client, so a clinician only ever sees flags for clients on their
 * consented care team (and a client would only see concerns they raised, but
 * the console routes are clinical-only anyway). The service role is used ONLY
 * to mint short-lived signed playback URLs for voice notes on rows RLS has
 * already returned.
 */

export type Sbar = {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
};

export type FlagVM = {
  id: string;
  clientId: string;
  clientName: string;
  mrn: string;
  raisedByName: string;
  raisedRole: "clinician" | "client";
  tier: "minor" | "major";
  summary: string | null;
  sbar: Sbar | null;
  transcript: string | null;
  voiceUrl: string | null;
  status: "open" | "reviewed";
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
  sessionId: string | null;
};

export async function getFlags(): Promise<FlagVM[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinical_flags")
    .select(
      `id, client_id, session_id, raised_role, tier, summary, sbar, transcript, voice_path,
       status, reviewed_at, created_at,
       clients!clinical_flags_client_id_fkey(mrn, profiles!clients_profile_id_fkey(full_name)),
       raised:profiles!clinical_flags_raised_by_fkey(full_name),
       reviewer:profiles!clinical_flags_reviewed_by_fkey(full_name)`,
    )
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  // Signed URLs only for voice paths on rows the viewer was allowed to read.
  const admin = getAdminClient();
  const flags: FlagVM[] = [];
  for (const row of data) {
    let voiceUrl: string | null = null;
    if (row.voice_path) {
      const { data: signed } = await admin.storage
        .from("voice-notes")
        .createSignedUrl(row.voice_path, 60 * 60);
      voiceUrl = signed?.signedUrl ?? null;
    }
    flags.push({
      id: row.id,
      clientId: row.client_id,
      clientName: row.clients?.profiles?.full_name ?? "Unknown",
      mrn: row.clients?.mrn ?? "",
      raisedByName: row.raised?.full_name ?? "Unknown",
      raisedRole: row.raised_role as "clinician" | "client",
      tier: row.tier as "minor" | "major",
      summary: row.summary,
      sbar: (row.sbar as Sbar | null) ?? null,
      transcript: row.transcript,
      voiceUrl,
      status: row.status as "open" | "reviewed",
      reviewedByName: row.reviewer?.full_name ?? null,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
      sessionId: row.session_id,
    });
  }
  return flags;
}

export type CareClient = { id: string; name: string; mrn: string };

/** Clients the viewer can raise a flag about (RLS: consented care team). */
export async function getCareClients(): Promise<CareClient[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("id, mrn, profiles!clients_profile_id_fkey(full_name)")
    .order("mrn");
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.profiles?.full_name ?? "Unknown",
    mrn: c.mrn,
  }));
}

/**
 * Compose the SBAR "Background" prefill for a client from their clinical
 * record and health profile (all read via RLS, so only for clients the viewer
 * may see). The clinician edits/extends it before submitting.
 */
export async function getClientBackground(clientId: string): Promise<string> {
  const supabase = await createClient();
  const [{ data: client }, { data: profile }] = await Promise.all([
    supabase
      .from("clients")
      .select("diagnosis, treatment_phase, programme_week, status")
      .eq("id", clientId)
      .maybeSingle(),
    supabase
      .from("client_health_profiles")
      .select("details, parq_positive, parq_completed_at")
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);
  if (!client) return "";

  const lines: string[] = [];
  lines.push(`Diagnosis: ${client.diagnosis}`);
  if (client.treatment_phase) lines.push(`Treatment phase: ${client.treatment_phase}`);
  if (client.programme_week != null) lines.push(`Programme week: ${client.programme_week}`);
  if (client.status !== "active") lines.push(`Programme status: ${client.status}`);

  const details = (profile?.details ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === "string" && value.trim()) {
      const label = key.replaceAll("_", " ");
      lines.push(`${label.charAt(0).toUpperCase()}${label.slice(1)}: ${value}`);
    }
  }
  if (profile?.parq_completed_at) {
    lines.push(
      profile.parq_positive
        ? "PAR-Q screening: completed, with one or more yes answers (see profile)."
        : "PAR-Q screening: completed, no yes answers.",
    );
  } else {
    lines.push("PAR-Q screening: not completed yet.");
  }
  return lines.join("\n");
}
