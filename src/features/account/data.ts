import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CareTeamMember } from "./AccountForms";

export type AccountInfo = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  discipline: string;
  registrationNo: string;
};

/** The caller's own profile (and clinician details if clinical). */
export async function getAccountInfo(): Promise<AccountInfo | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, email")
    .eq("id", user.id)
    .maybeSingle();

  const { data: clinician } = await supabase
    .from("clinicians")
    .select("discipline, registration_no")
    .eq("profile_id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? "",
    fullName: profile?.full_name ?? "",
    role: profile?.role ?? (user.app_metadata?.role as string) ?? "",
    discipline: clinician?.discipline ?? "",
    registrationNo: clinician?.registration_no ?? "",
  };
}

/** The calling client's care team with consent status. */
export async function getMyCareTeam(): Promise<CareTeamMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_care_team");
  if (error || !Array.isArray(data)) return [];
  return data as unknown as CareTeamMember[];
}
