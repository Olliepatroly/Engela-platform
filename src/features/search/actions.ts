"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { isRole, isClinical, type Role } from "@/lib/roles";
import { ROLE_LABELS } from "./data";

export type SearchActionState = { error: string | null; success: string | null };

type AdminClient = ReturnType<typeof getAdminClient>;

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** True when a pending request already links this client and member. */
async function hasPendingRequest(
  admin: AdminClient,
  clientId: string,
  clinicianId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("team_requests")
    .select("id")
    .eq("client_id", clientId)
    .eq("clinician_id", clinicianId)
    .eq("status", "pending")
    .limit(1);
  return (data ?? []).length > 0;
}

async function isOnTeam(
  admin: AdminClient,
  clientId: string,
  clinicianId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("care_team")
    .select("client_id")
    .eq("client_id", clientId)
    .eq("clinician_id", clinicianId)
    .maybeSingle();
  return data != null;
}

/** The target must be a community member (clinical role, not admin). */
async function memberProfile(admin: AdminClient, profileId: string) {
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", profileId)
    .maybeSingle();
  if (!data || !["consultant", "nurse", "cep", "physio"].includes(data.role)) return null;
  return data;
}

const requestMemberSchema = z.object({
  clinicianId: z.string().uuid(),
  message: z.string().trim().max(300).optional(),
});

/** A client asks a community member to join their team. */
export async function requestMember(
  _prev: SearchActionState,
  formData: FormData,
): Promise<SearchActionState> {
  const parsed = requestMemberSchema.safeParse({
    clinicianId: formData.get("clinicianId"),
    message: formData.get("message") || undefined,
  });
  if (!parsed.success) return { error: "Something went wrong. Try again.", success: null };

  const user = await currentUser();
  if (!user || user.app_metadata?.role !== "client") {
    return { error: "Only clients can send this request.", success: null };
  }

  const admin = getAdminClient();
  const { data: clientRow } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!clientRow) return { error: "No client record found.", success: null };

  const member = await memberProfile(admin, parsed.data.clinicianId);
  if (!member) return { error: "That community member could not be found.", success: null };

  if (await isOnTeam(admin, clientRow.id, member.id)) {
    return { error: `${member.full_name} is already part of your community.`, success: null };
  }
  if (await hasPendingRequest(admin, clientRow.id, member.id)) {
    return { error: "There is already a pending request between you.", success: null };
  }

  const { data: inserted, error } = await admin
    .from("team_requests")
    .insert({
      kind: "client_request",
      client_id: clientRow.id,
      clinician_id: member.id,
      requested_by: user.id,
      message: parsed.data.message || null,
    })
    .select("id")
    .single();
  if (error || !inserted) return { error: "Could not send the request. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "team_request.sent",
    entity: "team_requests",
    entity_id: inserted.id,
    meta: { kind: "client_request", client_id: clientRow.id, clinician_id: member.id },
  });

  revalidatePath("/app/community");
  revalidatePath("/console/search");
  return { error: null, success: `Request sent to ${member.full_name}. They will confirm shortly.` };
}

const inviteClientSchema = z.object({
  clientId: z.string().uuid(),
  message: z.string().trim().max(300).optional(),
});

/** A community member invites a client into their care. */
export async function inviteClient(
  _prev: SearchActionState,
  formData: FormData,
): Promise<SearchActionState> {
  const parsed = inviteClientSchema.safeParse({
    clientId: formData.get("clientId"),
    message: formData.get("message") || undefined,
  });
  if (!parsed.success) return { error: "Something went wrong. Try again.", success: null };

  const user = await currentUser();
  const role = user?.app_metadata?.role;
  if (!user || !isRole(role) || !isClinical(role) || role === "admin") {
    return { error: "Only community members can send invites.", success: null };
  }

  const admin = getAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id, profiles!clients_profile_id_fkey(full_name)")
    .eq("id", parsed.data.clientId)
    .maybeSingle();
  if (!client) return { error: "That client could not be found.", success: null };
  const clientName = client.profiles?.full_name ?? "this client";

  if (await isOnTeam(admin, client.id, user.id)) {
    return { error: `You are already on ${clientName}'s team.`, success: null };
  }
  if (await hasPendingRequest(admin, client.id, user.id)) {
    return { error: "There is already a pending request between you.", success: null };
  }

  const { data: inserted, error } = await admin
    .from("team_requests")
    .insert({
      kind: "clinician_invite",
      client_id: client.id,
      clinician_id: user.id,
      requested_by: user.id,
      message: parsed.data.message || null,
    })
    .select("id")
    .single();
  if (error || !inserted) return { error: "Could not send the invite. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "team_request.sent",
    entity: "team_requests",
    entity_id: inserted.id,
    meta: { kind: "clinician_invite", client_id: client.id, clinician_id: user.id },
  });

  revalidatePath("/console/search");
  revalidatePath("/app/community");
  return {
    error: null,
    success: `Invite sent. ${clientName} decides whether to add you to their community.`,
  };
}

const invitePeerSchema = z.object({
  clinicianId: z.string().uuid(),
  clientId: z.string().uuid(),
});

/** A community member invites a fellow member to one of their clients' teams. */
export async function invitePeer(
  _prev: SearchActionState,
  formData: FormData,
): Promise<SearchActionState> {
  const parsed = invitePeerSchema.safeParse({
    clinicianId: formData.get("clinicianId"),
    clientId: formData.get("clientId"),
  });
  if (!parsed.success) return { error: "Pick which client's team to invite them to.", success: null };

  const user = await currentUser();
  const role = user?.app_metadata?.role;
  if (!user || !isRole(role) || !isClinical(role)) {
    return { error: "Only community members can send invites.", success: null };
  }

  // The inviter must themselves see this client (care team with consent):
  // checked through their own RLS read, same as every clinician write.
  const supabase = await createClient();
  const { data: visibleClient } = await supabase
    .from("clients")
    .select("id")
    .eq("id", parsed.data.clientId)
    .maybeSingle();
  if (!visibleClient) return { error: "You do not have access to this client.", success: null };

  const admin = getAdminClient();
  const member = await memberProfile(admin, parsed.data.clinicianId);
  if (!member) return { error: "That community member could not be found.", success: null };
  if (member.id === user.id) return { error: "You are already on this team.", success: null };

  if (await isOnTeam(admin, parsed.data.clientId, member.id)) {
    return { error: `${member.full_name} is already on this client's team.`, success: null };
  }
  if (await hasPendingRequest(admin, parsed.data.clientId, member.id)) {
    return { error: "There is already a pending request between them.", success: null };
  }

  const { data: inserted, error } = await admin
    .from("team_requests")
    .insert({
      kind: "peer_invite",
      client_id: parsed.data.clientId,
      clinician_id: member.id,
      requested_by: user.id,
    })
    .select("id")
    .single();
  if (error || !inserted) return { error: "Could not send the invite. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "team_request.sent",
    entity: "team_requests",
    entity_id: inserted.id,
    meta: { kind: "peer_invite", client_id: parsed.data.clientId, clinician_id: member.id },
  });

  revalidatePath("/console/search");
  return { error: null, success: `Invite sent to ${member.full_name}.` };
}

const respondSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["accept", "decline"]),
});

/**
 * Accept or decline a pending request. Accepting writes the care_team row.
 * Consent stays the client's alone: their own request or their acceptance
 * grants it; a member-to-member invite joins with sharing paused until the
 * client turns it on in The community.
 */
export async function respondToRequest(
  _prev: SearchActionState,
  formData: FormData,
): Promise<SearchActionState> {
  const parsed = respondSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) return { error: "Something went wrong. Try again.", success: null };

  const user = await currentUser();
  if (!user) return { error: "Your session has expired. Sign in again.", success: null };
  const role = user.app_metadata?.role as Role | undefined;

  const admin = getAdminClient();
  const { data: request } = await admin
    .from("team_requests")
    .select("id, kind, status, client_id, clinician_id, clients(profile_id)")
    .eq("id", parsed.data.requestId)
    .maybeSingle();
  if (!request || request.status !== "pending") {
    return { error: "This request has already been dealt with.", success: null };
  }

  // Only the recipient can respond.
  const isRecipient =
    request.kind === "clinician_invite"
      ? role === "client" && request.clients?.profile_id === user.id
      : request.clinician_id === user.id;
  if (!isRecipient) return { error: "This request is not yours to answer.", success: null };

  const accept = parsed.data.decision === "accept";
  const now = new Date().toISOString();

  if (accept) {
    const { data: clinician } = await admin
      .from("clinicians")
      .select("discipline")
      .eq("profile_id", request.clinician_id)
      .maybeSingle();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", request.clinician_id)
      .maybeSingle();
    const relationship = clinician?.discipline ?? ROLE_LABELS[profile?.role ?? ""] ?? null;

    // Consent rule: the client's own action grants it. A peer invite starts
    // with sharing paused; the client can turn it on in The community.
    const consentAt = request.kind === "peer_invite" ? null : now;

    const existing = await admin
      .from("care_team")
      .select("client_id")
      .eq("client_id", request.client_id)
      .eq("clinician_id", request.clinician_id)
      .maybeSingle();
    if (!existing.data) {
      const { error } = await admin.from("care_team").insert({
        client_id: request.client_id,
        clinician_id: request.clinician_id,
        relationship,
        consent_at: consentAt,
      });
      if (error) return { error: "Could not update the team. Try again.", success: null };
    }
  }

  const { error } = await admin
    .from("team_requests")
    .update({
      status: accept ? "accepted" : "declined",
      resolved_at: now,
      resolved_by: user.id,
    })
    .eq("id", request.id);
  if (error) return { error: "Could not save your answer. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: accept ? "team_request.accepted" : "team_request.declined",
    entity: "team_requests",
    entity_id: request.id,
    meta: { kind: request.kind, client_id: request.client_id, clinician_id: request.clinician_id },
  });

  revalidatePath("/console/search");
  revalidatePath("/app/community");
  revalidatePath("/console");
  return {
    error: null,
    success: accept
      ? request.kind === "peer_invite"
        ? "Added to the team. Sharing stays paused until the client turns it on."
        : "Accepted. The team is updated."
      : "Declined.",
  };
}

const cancelSchema = z.object({ requestId: z.string().uuid() });

/** The sender withdraws a pending request. */
export async function cancelRequest(
  _prev: SearchActionState,
  formData: FormData,
): Promise<SearchActionState> {
  const parsed = cancelSchema.safeParse({ requestId: formData.get("requestId") });
  if (!parsed.success) return { error: "Something went wrong. Try again.", success: null };

  const user = await currentUser();
  if (!user) return { error: "Your session has expired. Sign in again.", success: null };

  const admin = getAdminClient();
  const { data: request } = await admin
    .from("team_requests")
    .select("id, status, requested_by, client_id, clinician_id, kind")
    .eq("id", parsed.data.requestId)
    .maybeSingle();
  if (!request || request.status !== "pending" || request.requested_by !== user.id) {
    return { error: "This request cannot be withdrawn.", success: null };
  }

  const { error } = await admin
    .from("team_requests")
    .update({ status: "cancelled", resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq("id", request.id);
  if (error) return { error: "Could not withdraw the request. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "team_request.cancelled",
    entity: "team_requests",
    entity_id: request.id,
    meta: { kind: request.kind, client_id: request.client_id, clinician_id: request.clinician_id },
  });

  revalidatePath("/console/search");
  revalidatePath("/app/community");
  return { error: null, success: "Request withdrawn." };
}
