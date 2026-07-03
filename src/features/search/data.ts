import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type RequestKind = Database["public"]["Enums"]["team_request_kind"];
export type RequestStatus = Database["public"]["Enums"]["team_request_status"];

export type DirectoryEntry = {
  kind: "member" | "client";
  /** profiles.id for a member; clients.id for a client. */
  id: string;
  fullName: string;
  role: string;
  discipline: string | null;
};

export const ROLE_LABELS: Record<string, string> = {
  consultant: "Consultant",
  nurse: "Specialist nurse",
  cep: "Exercise physiologist",
  physio: "Physiotherapist",
  client: "Client",
  admin: "Admin",
};

export type TeamRequestVM = {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  message: string | null;
  createdAt: string;
  clientId: string;
  clientName: string;
  clinicianId: string;
  clinicianName: string;
  clinicianRole: string | null;
  clinicianDiscipline: string | null;
  requestedBy: string;
  requestedByName: string;
};

/**
 * Directory search (safe fields only: names, role, discipline). The database
 * function scopes results by role: clients see community members; clinical
 * callers also see clients.
 */
export async function searchDirectory(q: string): Promise<DirectoryEntry[]> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_directory", { q: trimmed });
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => ({
    kind: row.kind === "client" ? "client" : "member",
    id: row.id,
    fullName: row.full_name,
    role: row.member_role,
    discipline: row.discipline,
  }));
}

/** Every request the caller is involved in, newest first, with names. */
export async function getMyTeamRequests(): Promise<TeamRequestVM[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_team_requests");
  if (error || !Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    kind: r.kind as RequestKind,
    status: r.status as RequestStatus,
    message: (r.message as string | null) ?? null,
    createdAt: String(r.created_at),
    clientId: String(r.client_id),
    clientName: String(r.client_name),
    clinicianId: String(r.clinician_id),
    clinicianName: String(r.clinician_name),
    clinicianRole: (r.clinician_role as string | null) ?? null,
    clinicianDiscipline: (r.clinician_discipline as string | null) ?? null,
    requestedBy: String(r.requested_by),
    requestedByName: String(r.requested_by_name),
  }));
}

/** The clinician's current client ids (their care team memberships). */
export async function getMyTeamClientIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data } = await supabase.from("care_team").select("client_id").eq("clinician_id", user.id);
  return new Set((data ?? []).map((r) => r.client_id));
}
