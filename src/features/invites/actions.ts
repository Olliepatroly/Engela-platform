"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { homePathForRole, isClinical, isRole, type Role } from "@/lib/roles";

export type InviteState = {
  error: string | null;
  success: string | null;
  inviteUrl: string | null;
  emailSent: boolean;
};

export type AcceptState = { error: string | null };
export type RequestState = { error: string | null; success: string | null };

const INVITE_VALID_DAYS = 7;

/** Roles each clinical role may invite. Nobody invites an admin from the UI. */
function invitableRoles(inviter: Role): Role[] {
  if (inviter === "consultant" || inviter === "admin") {
    return ["consultant", "nurse", "cep", "physio", "client"];
  }
  return ["client"];
}

/** 32 random bytes as hex. The raw token lives only in the link; we store its hash. */
function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Placeholder MRN for a client invited without one; the team corrects it later. */
function placeholderMrn(fullName: string): string {
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `HCA-${initials || "XX"}-${digits}`;
}

async function requireClinicalUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;
  if (!user || !isRole(role) || !isClinical(role)) return null;
  return { user, role };
}

async function siteOrigin(): Promise<string> {
  const origin = (await headers()).get("origin");
  return origin ?? env.NEXT_PUBLIC_SITE_URL;
}

const createInviteSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the invitee's full name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(["consultant", "nurse", "cep", "physio", "client"]),
  mrn: z.string().trim().max(40).optional(),
  diagnosis: z.string().trim().max(200).optional(),
});

type IssueInviteInput = {
  fullName: string;
  email: string;
  role: Role;
  mrn?: string;
  diagnosis?: string;
  invitedBy: string;
};

type IssueInviteResult =
  | { error: string }
  | { error: null; inviteId: string; inviteUrl: string; emailSent: boolean };

/**
 * The single path that issues an invitation: duplicate checks, token issue
 * (only the SHA-256 hash is stored), the email to the invitee when Resend is
 * configured, and the audit entry. Used by the manual invite form and by
 * request approval, so both flows carry identical safeguards. Callers have
 * already authorised the inviter for the role.
 */
async function issueInvite(input: IssueInviteInput): Promise<IssueInviteResult> {
  const { fullName, email, role, invitedBy } = input;
  const admin = getAdminClient();

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (existingProfile) {
    return { error: "That email already has an account." };
  }

  const { data: pending } = await admin
    .from("invites")
    .select("id")
    .ilike("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (pending) {
    return {
      error: "A live invitation already exists for that email. Revoke it first to send a new one.",
    };
  }

  const token = newToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + INVITE_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: invite, error } = await admin
    .from("invites")
    .insert({
      email,
      full_name: fullName,
      role,
      token_hash: tokenHash,
      invited_by: invitedBy,
      mrn: role === "client" ? input.mrn || null : null,
      diagnosis: role === "client" ? input.diagnosis || null : null,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error || !invite) {
    return { error: "Could not create the invitation. Try again." };
  }

  const inviteUrl = `${await siteOrigin()}/invite/${token}`;

  const emailSent = await sendEmail({
    to: email,
    subject: "Your invitation to Engela Health",
    text: [
      `Hello ${fullName},`,
      "",
      "You have been invited to join the Engela Health rehabilitation platform.",
      "",
      `Accept your invitation here: ${inviteUrl}`,
      "",
      `The link is personal to you and valid for ${INVITE_VALID_DAYS} days.`,
      "If you were not expecting this invitation, you can ignore this email.",
      "",
      "Engela Health",
    ].join("\n"),
  });

  await admin.from("audit_log").insert({
    actor_id: invitedBy,
    action: "invite.created",
    entity: "invites",
    entity_id: invite.id,
    meta: { email, role, email_sent: emailSent },
  });

  return { error: null, inviteId: invite.id, inviteUrl, emailSent };
}

/**
 * Create a signed invite: a single-use link valid for seven days. Only the
 * SHA-256 hash of the token is stored. If Resend is configured the invite is
 * emailed; either way the link is returned so the inviter can share it
 * personally. Audited.
 */
export async function createInvite(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const none = { inviteUrl: null, emailSent: false };
  const parsed = createInviteSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    role: formData.get("role"),
    mrn: formData.get("mrn") || undefined,
    diagnosis: formData.get("diagnosis") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details.", success: null, ...none };
  }
  const { fullName, email, role } = parsed.data;

  const caller = await requireClinicalUser();
  if (!caller) return { error: "Only the clinical team can send invitations.", success: null, ...none };
  if (!invitableRoles(caller.role).includes(role)) {
    return { error: "Clinical team invitations go through the rehab lead.", success: null, ...none };
  }

  const issued = await issueInvite({
    fullName,
    email,
    role,
    mrn: parsed.data.mrn,
    diagnosis: parsed.data.diagnosis,
    invitedBy: caller.user.id,
  });
  if (issued.error != null) return { error: issued.error, success: null, ...none };

  revalidatePath("/console/invites");
  return {
    error: null,
    success: issued.emailSent
      ? `Invitation emailed to ${email}. The link below is a copy you can share directly.`
      : `Invitation created. Email sending is not configured yet, so share the link below with ${fullName} personally (it signs them straight in, treat it like a password).`,
    inviteUrl: issued.inviteUrl,
    emailSent: issued.emailSent,
  };
}

const approveRequestSchema = z.object({
  requestId: z.string().uuid(),
  role: z.enum(["consultant", "nurse", "cep", "physio", "client"]),
});

/**
 * Approve a create-account request in one step: issues the signed invitation
 * to the requester (emailed when Resend is configured, link shown either way),
 * marks the request handled, and audits the approval. The approver chooses the
 * role for team requests; a client request always becomes a client invite.
 * Role authorisation is identical to the manual form (invitableRoles).
 */
export async function approveRequest(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const none = { inviteUrl: null, emailSent: false };
  const parsed = approveRequestSchema.safeParse({
    requestId: formData.get("requestId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "Check the request and role.", success: null, ...none };

  const caller = await requireClinicalUser();
  if (!caller) return { error: "Only the clinical team can approve requests.", success: null, ...none };
  if (!invitableRoles(caller.role).includes(parsed.data.role)) {
    return { error: "Clinical team invitations go through the rehab lead.", success: null, ...none };
  }

  const admin = getAdminClient();
  const { data: request } = await admin
    .from("account_requests")
    .select("id, path, full_name, email, status")
    .eq("id", parsed.data.requestId)
    .maybeSingle();
  if (!request) return { error: "Unknown request.", success: null, ...none };
  if (request.status !== "new") {
    return { error: "That request is already handled.", success: null, ...none };
  }
  // A client-path request can only ever become a client account.
  if (request.path === "client" && parsed.data.role !== "client") {
    return { error: "A client request can only be approved as a client.", success: null, ...none };
  }

  const issued = await issueInvite({
    fullName: request.full_name,
    email: request.email.toLowerCase(),
    role: parsed.data.role,
    invitedBy: caller.user.id,
  });
  if (issued.error != null) return { error: issued.error, success: null, ...none };

  await admin.from("account_requests").update({ status: "handled" }).eq("id", request.id);

  await admin.from("audit_log").insert({
    actor_id: caller.user.id,
    action: "account_request.approved",
    entity: "account_requests",
    entity_id: request.id,
    meta: { email: request.email, role: parsed.data.role, invite_id: issued.inviteId },
  });

  revalidatePath("/console/invites");
  return {
    error: null,
    success: issued.emailSent
      ? `Approved. The invitation has been emailed to ${request.email}.`
      : `Approved and the invitation is created. Email sending is not configured yet, so share the link below with ${request.full_name} personally (it signs them straight in, treat it like a password).`,
    inviteUrl: issued.inviteUrl,
    emailSent: issued.emailSent,
  };
}

/** Revoke a pending invite (inviter or admin). Audited. */
export async function revokeInvite(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const inviteId = z.string().uuid().safeParse(formData.get("inviteId"));
  if (!inviteId.success) return { error: "Unknown invitation.", success: null };

  const caller = await requireClinicalUser();
  if (!caller) return { error: "Only the clinical team can manage invitations.", success: null };

  const admin = getAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("id, invited_by, accepted_at, revoked_at, email")
    .eq("id", inviteId.data)
    .maybeSingle();
  if (!invite || (invite.invited_by !== caller.user.id && caller.role !== "admin")) {
    return { error: "Unknown invitation.", success: null };
  }
  if (invite.accepted_at) return { error: "That invitation was already accepted.", success: null };
  if (invite.revoked_at) return { error: "That invitation is already revoked.", success: null };

  const { error } = await admin
    .from("invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", invite.id);
  if (error) return { error: "Could not revoke the invitation. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: caller.user.id,
    action: "invite.revoked",
    entity: "invites",
    entity_id: invite.id,
    meta: { email: invite.email },
  });

  revalidatePath("/console/invites");
  return { error: null, success: "Invitation revoked. The link no longer works." };
}

/** Mark a create-account request as handled (typically after sending an invite). */
export async function markRequestHandled(
  _prev: RequestState,
  formData: FormData,
): Promise<RequestState> {
  const requestId = z.string().uuid().safeParse(formData.get("requestId"));
  if (!requestId.success) return { error: "Unknown request.", success: null };

  const caller = await requireClinicalUser();
  if (!caller) return { error: "Only the clinical team can manage requests.", success: null };

  const admin = getAdminClient();
  const { error } = await admin
    .from("account_requests")
    .update({ status: "handled" })
    .eq("id", requestId.data);
  if (error) return { error: "Could not update the request. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: caller.user.id,
    action: "account_request.handled",
    entity: "account_requests",
    entity_id: requestId.data,
    meta: {},
  });

  revalidatePath("/console/invites");
  return { error: null, success: "Request marked as handled." };
}

const requestAccountSchema = z.object({
  path: z.enum(["team", "client"]),
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  requestedRole: z.string().trim().max(60).optional(),
});

/**
 * Public create-account request: files the request for the clinical team's
 * invites screen. Deliberately quiet about what exists already (no account or
 * email enumeration); duplicate live requests collapse into one.
 */
export async function requestAccount(
  _prev: RequestState,
  formData: FormData,
): Promise<RequestState> {
  const parsed = requestAccountSchema.safeParse({
    path: formData.get("path"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    requestedRole: formData.get("role") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details.", success: null };
  }
  const { path, fullName, email, requestedRole } = parsed.data;

  const admin = getAdminClient();
  const { data: existing } = await admin
    .from("account_requests")
    .select("id")
    .ilike("email", email)
    .eq("status", "new")
    .maybeSingle();

  if (!existing) {
    const { data: created, error } = await admin
      .from("account_requests")
      .insert({ path, full_name: fullName, email, requested_role: requestedRole ?? null })
      .select("id")
      .single();
    if (error || !created) return { error: "Something went wrong. Try again.", success: null };

    // Route the request to the approver. Delivery needs RESEND_API_KEY; the
    // request is on /console/invites regardless, so a failed send only means
    // no notification, never a lost request.
    const approverNotified = await sendEmail({
      to: env.ACCOUNT_REQUEST_APPROVER_EMAIL,
      subject: `Account request: ${fullName} (${path === "team" ? "clinical team" : "client"})`,
      text: [
        "A new account request needs your approval.",
        "",
        `Name: ${fullName}`,
        `Email: ${email}`,
        `Path: ${path === "team" ? "Clinical team" : "Client"}${requestedRole ? ` (${requestedRole})` : ""}`,
        "",
        `Approve or decline it here: ${env.NEXT_PUBLIC_SITE_URL}/console/invites`,
        "",
        "Approving sends them a personal, single-use invitation link (valid seven days).",
        "Nobody gets an account without an invitation.",
      ].join("\n"),
    });

    await admin.from("audit_log").insert({
      actor_id: null,
      action: "account_request.created",
      entity: "account_requests",
      entity_id: created.id,
      meta: { path, approver_notified: approverNotified },
    });
  }

  return {
    error: null,
    success:
      path === "team"
        ? "Thank you. The rehab lead will be in touch with a personal invitation."
        : "Thank you. Your community will be in touch with a personal invitation.",
  };
}

const acceptInviteSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/, "This invitation link is not valid."),
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  password: z.string().min(10, "Use at least 10 characters."),
});

/** Discipline shown to colleagues until the new member edits it. */
const ROLE_DISCIPLINES: Record<string, string> = {
  consultant: "Consultant",
  nurse: "Specialist nurse",
  cep: "Clinical exercise physiologist",
  physio: "Physiotherapist",
};

/**
 * Accept a signed invite: creates the account with the invited role (the only
 * way a role is ever assigned), the profile, and the client or clinician
 * record. A client accepting a clinician's invite is the client's own
 * consenting action, so the care-team link starts with consent granted.
 * Signs the new member in and sends them to their surface. Audited.
 */
export async function acceptInvite(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const parsed = acceptInviteSchema.safeParse({
    token: formData.get("token"),
    fullName: formData.get("fullName"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }
  const { token, fullName, password } = parsed.data;

  const admin = getAdminClient();
  const tokenHash = await sha256Hex(token);
  const { data: invite } = await admin
    .from("invites")
    .select("id, email, role, invited_by, mrn, diagnosis, expires_at, accepted_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (
    !invite ||
    invite.accepted_at != null ||
    invite.revoked_at != null ||
    new Date(invite.expires_at).getTime() < Date.now()
  ) {
    return { error: "This invitation link is no longer valid. Ask your inviter for a new one." };
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    app_metadata: { role: invite.role },
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) {
    return { error: "Could not create the account. Ask your inviter for a new invitation." };
  }
  const userId = created.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    role: invite.role,
    full_name: fullName,
    email: invite.email,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return { error: "Could not create the account. Ask your inviter for a new invitation." };
  }

  if (invite.role === "client") {
    const { data: inviterClinical } = await admin
      .from("clinicians")
      .select("discipline")
      .eq("profile_id", invite.invited_by)
      .maybeSingle();
    const { data: inviterProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", invite.invited_by)
      .maybeSingle();

    const { data: clientRow, error: clientError } = await admin
      .from("clients")
      .insert({
        profile_id: userId,
        mrn: invite.mrn || placeholderMrn(fullName),
        diagnosis: invite.diagnosis || "To be recorded at the first review",
        consultant_id: inviterProfile?.role === "consultant" ? invite.invited_by : null,
      })
      .select("id")
      .single();
    if (clientError || !clientRow) {
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
      return { error: "Could not create the account. Ask your inviter for a new invitation." };
    }

    // Accepting the invitation is the client's own action, so the inviter's
    // care-team membership starts with consent granted. The client can pause
    // sharing at any time in The community.
    await admin.from("care_team").insert({
      client_id: clientRow.id,
      clinician_id: invite.invited_by,
      relationship: inviterClinical?.discipline ?? null,
      consent_at: new Date().toISOString(),
    });
  } else {
    await admin.from("clinicians").insert({
      profile_id: userId,
      discipline: ROLE_DISCIPLINES[invite.role] ?? "Clinical team",
    });
  }

  await admin
    .from("invites")
    .update({ accepted_at: new Date().toISOString(), accepted_profile: userId })
    .eq("id", invite.id);

  await admin.from("audit_log").insert({
    actor_id: userId,
    action: "invite.accepted",
    entity: "invites",
    entity_id: invite.id,
    meta: { role: invite.role, invited_by: invite.invited_by },
  });

  // Sign the new member in with the credentials they just set.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: invite.email,
    password,
  });
  if (signInError) redirect("/signin");
  redirect(homePathForRole(invite.role));
}
