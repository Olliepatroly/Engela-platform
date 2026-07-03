import "server-only";

import { getRoster, type RosterEntry } from "@/features/console";
import type { ProgramPatient } from "@/features/programs";
import { createClient } from "@/lib/supabase/server";

export type ProgramsPageContext = {
  viewerName: string;
  viewerId: string | null;
  /** CEP/admin: builds blocks, sessions and the library. */
  canBuild: boolean;
  /** CEP/physio/admin: can mark session parts done for the client. */
  canComplete: boolean;
  roster: RosterEntry[];
  selected: ProgramPatient | null;
};

/** Everything the four programme pages share: viewer, roster, selection. */
export async function getProgramsPageContext(
  patientParam: string | undefined,
): Promise<ProgramsPageContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Clinical team";
  const role = user?.app_metadata?.role as string | undefined;

  const roster = await getRoster();
  const selectedId = patientParam ?? roster[0]?.clientId;
  const entry = roster.find((r) => r.clientId === selectedId) ?? null;

  return {
    viewerName,
    viewerId: user?.id ?? null,
    canBuild: role === "cep" || role === "admin",
    canComplete: role === "cep" || role === "physio" || role === "admin",
    roster,
    selected: entry
      ? { clientId: entry.clientId, fullName: entry.fullName, mrn: entry.mrn }
      : null,
  };
}
