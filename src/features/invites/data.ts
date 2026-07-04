import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/roles";

export type InviteVM = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  status: "pending" | "accepted" | "revoked" | "expired";
};

export type AccountRequestVM = {
  id: string;
  path: "team" | "client";
  fullName: string;
  email: string;
  requestedRole: string | null;
  createdAt: string;
};

export type InvitePreview = {
  fullName: string;
  email: string;
  role: Role;
  inviterName: string;
};

/** Invitations the caller sent (RLS: inviter or admin), newest first. */
export async function getInvites(): Promise<InviteVM[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invites")
    .select("id, email, full_name, role, created_at, expires_at, accepted_at, revoked_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const now = Date.now();
  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    status: row.accepted_at
      ? "accepted"
      : row.revoked_at
        ? "revoked"
        : new Date(row.expires_at).getTime() < now
          ? "expired"
          : "pending",
  }));
}

/** Open create-account requests for the clinical team to follow up. */
export async function getAccountRequests(): Promise<AccountRequestVM[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("account_requests")
    .select("id, path, full_name, email, requested_role, created_at")
    .eq("status", "new")
    .order("created_at", { ascending: false })
    .limit(100);

  return (data ?? []).map((row) => ({
    id: row.id,
    path: row.path as "team" | "client",
    fullName: row.full_name,
    email: row.email,
    requestedRole: row.requested_role,
    createdAt: row.created_at,
  }));
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Look up a live invite by its raw token for the acceptance page. Uses the
 * service role (the visitor is unauthenticated); returns nothing unless the
 * invite is pending, unrevoked and unexpired.
 */
export async function getInvitePreview(token: string): Promise<InvitePreview | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;

  const admin = getAdminClient();
  const tokenHash = await sha256Hex(token);
  const { data: invite } = await admin
    .from("invites")
    .select("full_name, email, role, invited_by, expires_at, accepted_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (
    !invite ||
    invite.accepted_at != null ||
    invite.revoked_at != null ||
    new Date(invite.expires_at).getTime() < Date.now()
  ) {
    return null;
  }

  const { data: inviter } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", invite.invited_by)
    .maybeSingle();

  return {
    fullName: invite.full_name,
    email: invite.email,
    role: invite.role as Role,
    inviterName: inviter?.full_name ?? "the Engela Health team",
  };
}
