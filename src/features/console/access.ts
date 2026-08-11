import "server-only";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isClinical, isRole } from "@/lib/roles";

/**
 * The authorisation check every clinician write shares: the session must
 * belong to a clinical role AND RLS must let that session see this client
 * (care team with consent). The session's own RLS read is the check — the
 * service role is only ever used for the write that follows.
 *
 * Deliberately not a server action: it lives here rather than in an action
 * module so both `entry-actions` and `review-actions` can import it without
 * exposing it as a callable endpoint.
 */
export async function requireClinicalAccess(clientId: string): Promise<User | null> {
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
