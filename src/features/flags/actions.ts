"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

export type FlagActionState = { error: string | null; success: string | null };

const CLINICAL_ROLES = ["consultant", "nurse", "cep", "physio", "admin"];

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** RLS as the authorisation check: the viewer must be able to see the client. */
async function canSeeClient(clientId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
  return data != null;
}

const sbarSchema = z.object({
  clientId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  tier: z.enum(["minor", "major"]),
  summary: z.string().trim().min(3, "Give the flag a short headline.").max(200),
  situation: z.string().trim().min(10, "Describe the situation (what happened).").max(2000),
  background: z.string().trim().min(10, "Complete the background.").max(4000),
  assessment: z
    .string()
    .trim()
    .min(10, "Record the assessment: questions asked, readings and observations.")
    .max(4000),
  recommendation: z
    .string()
    .trim()
    .min(10, "Record what was recommended or asked for.")
    .max(2000),
});

/**
 * A clinician (CEP, physio, nurse, consultant, admin) raises a tiered clinical
 * flag about a client. The full SBAR is required: this action is the prompt.
 * Authorisation is the RLS care-team read; the write is service-role and
 * audited (tier + client only in the meta, no clinical content).
 */
export async function raiseClinicianFlag(
  _prev: FlagActionState,
  formData: FormData,
): Promise<FlagActionState> {
  const parsed = sbarSchema.safeParse({
    clientId: formData.get("clientId"),
    sessionId: formData.get("sessionId") || undefined,
    tier: formData.get("tier"),
    summary: formData.get("summary"),
    situation: formData.get("situation"),
    background: formData.get("background"),
    assessment: formData.get("assessment"),
    recommendation: formData.get("recommendation"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form.", success: null };
  }

  const user = await requireUser();
  const role = user?.app_metadata?.role as string | undefined;
  if (!user || !role || !CLINICAL_ROLES.includes(role)) {
    return { error: "Only the clinical team can raise a flag here.", success: null };
  }
  if (!(await canSeeClient(parsed.data.clientId))) {
    return { error: "You can only raise a flag for a client on your care team.", success: null };
  }

  const admin = getAdminClient();
  const { data: inserted, error } = await admin
    .from("clinical_flags")
    .insert({
      client_id: parsed.data.clientId,
      session_id: parsed.data.sessionId ?? null,
      raised_by: user.id,
      raised_role: "clinician",
      tier: parsed.data.tier,
      summary: parsed.data.summary,
      sbar: {
        situation: parsed.data.situation,
        background: parsed.data.background,
        assessment: parsed.data.assessment,
        recommendation: parsed.data.recommendation,
      },
    })
    .select("id")
    .single();
  if (error) return { error: "Could not raise the flag. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "clinical_flag.raised",
    entity: "clinical_flags",
    entity_id: inserted?.id ?? null,
    meta: { client_id: parsed.data.clientId, tier: parsed.data.tier, raised_role: "clinician" },
  });

  revalidatePath("/console/flags");
  return {
    error: null,
    success:
      parsed.data.tier === "major"
        ? "Major flag raised with full SBAR. The team can see it now."
        : "Minor flag raised with full SBAR.",
  };
}

/** Mark a flag reviewed (clinical team; RLS decides whose flags are visible). */
export async function markFlagReviewed(
  _prev: FlagActionState,
  formData: FormData,
): Promise<FlagActionState> {
  const flagId = z.string().uuid().safeParse(formData.get("flagId"));
  if (!flagId.success) return { error: "Unknown flag.", success: null };

  const user = await requireUser();
  const role = user?.app_metadata?.role as string | undefined;
  if (!user || !role || !CLINICAL_ROLES.includes(role)) {
    return { error: "Only the clinical team can review flags.", success: null };
  }

  // RLS check: the viewer must be able to read this flag.
  const supabase = await createClient();
  const { data: visible } = await supabase
    .from("clinical_flags")
    .select("id, client_id, status")
    .eq("id", flagId.data)
    .maybeSingle();
  if (!visible) return { error: "That flag is not in your care.", success: null };
  if (visible.status === "reviewed") return { error: null, success: "Already reviewed." };

  const admin = getAdminClient();
  const { error } = await admin
    .from("clinical_flags")
    .update({ status: "reviewed", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", flagId.data);
  if (error) return { error: "Could not update the flag. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "clinical_flag.reviewed",
    entity: "clinical_flags",
    entity_id: flagId.data,
    meta: { client_id: visible.client_id },
  });

  revalidatePath("/console/flags");
  return { error: null, success: "Marked as reviewed." };
}

const concernSchema = z.object({
  tier: z.enum(["minor", "major"]),
  sessionId: z.string().uuid().optional(),
  transcript: z.string().trim().max(4000).optional(),
});

const AUDIO_TYPES = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav"];
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/**
 * A client raises a concern after a self-conducted session: a voice note
 * describing what happened (or a typed description if the microphone is not
 * available). Stored in the private voice-notes bucket via the service role;
 * the clinical team reviews it on the console. The UI tells the client to call
 * 999 for any emergency; this records a concern, it does not alert anyone.
 */
export async function raiseClientConcern(formData: FormData): Promise<FlagActionState> {
  const parsed = concernSchema.safeParse({
    tier: formData.get("tier"),
    sessionId: formData.get("sessionId") || undefined,
    transcript: (formData.get("transcript") as string | null) || undefined,
  });
  if (!parsed.success) return { error: "Check the form and try again.", success: null };

  const audio = formData.get("audio");
  const hasAudio = audio instanceof File && audio.size > 0;
  if (!hasAudio && !parsed.data.transcript) {
    return { error: "Record a voice note or describe what happened.", success: null };
  }
  const baseType = hasAudio ? (audio.type.split(";")[0] ?? "") : "";
  if (hasAudio) {
    if (audio.size > MAX_AUDIO_BYTES) {
      return { error: "That recording is too long. Keep it under two minutes.", success: null };
    }
    if (!AUDIO_TYPES.includes(baseType)) {
      return { error: "That recording format is not supported.", success: null };
    }
  }

  const user = await requireUser();
  if (!user || user.app_metadata?.role !== "client") {
    return { error: "Only clients can raise a concern here.", success: null };
  }

  const admin = getAdminClient();
  const { data: clientRow } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!clientRow) return { error: "No client record found.", success: null };

  // If tied to a session, it must be the client's own session.
  if (parsed.data.sessionId) {
    const { data: session } = await admin
      .from("program_sessions")
      .select("id, client_id")
      .eq("id", parsed.data.sessionId)
      .maybeSingle();
    if (!session || session.client_id !== clientRow.id) {
      return { error: "That session does not belong to you.", success: null };
    }
  }

  let voicePath: string | null = null;
  if (hasAudio) {
    const ext = baseType === "audio/mp4" ? "m4a" : (baseType.split("/")[1] ?? "webm");
    voicePath = `${clientRow.id}/${crypto.randomUUID()}.${ext}`;
    const buffer = await audio.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from("voice-notes")
      .upload(voicePath, buffer, { contentType: baseType });
    if (uploadError) {
      return { error: "Could not save the recording. Try again.", success: null };
    }
  }

  const { data: inserted, error } = await admin
    .from("clinical_flags")
    .insert({
      client_id: clientRow.id,
      session_id: parsed.data.sessionId ?? null,
      raised_by: user.id,
      raised_role: "client",
      tier: parsed.data.tier,
      voice_path: voicePath,
      transcript: parsed.data.transcript ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: "Could not send your concern. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "clinical_flag.raised",
    entity: "clinical_flags",
    entity_id: inserted?.id ?? null,
    meta: { client_id: clientRow.id, tier: parsed.data.tier, raised_role: "client" },
  });

  revalidatePath("/console/flags");
  return {
    error: null,
    success: "Thank you. Your team can hear this now and will come back to you.",
  };
}
