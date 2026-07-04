import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * The client / care-team message thread. Reads go through the RLS server client
 * (cookie-scoped), so the client only ever sees their own thread; the SELECT
 * policy also lets the consented care team read it.
 *
 * Staged: the messages table ships in migration 0017. Until it is applied the
 * query errors (relation/schema-cache miss) and we report `available: false`,
 * so the app hides the feature rather than breaking. The table is not yet in the
 * generated types, hence the untyped-client cast; switch to the typed client
 * after regenerating types.
 */
export type ThreadMessage = {
  id: string;
  body: string;
  sender_role: "client" | "clinician";
  sender_name: string | null;
  created_at: string;
  mine: boolean;
};

export type Thread = {
  available: boolean;
  messages: ThreadMessage[];
};

type Row = {
  id: string;
  body: string;
  sender_role: "client" | "clinician";
  sender_id: string;
  created_at: string;
  profiles: { full_name: string } | null;
};

export async function getThread(): Promise<Thread> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { available: false, messages: [] };

  const staged = supabase as unknown as SupabaseClient;
  const { data, error } = await staged
    .from("messages")
    .select("id, body, sender_role, sender_id, created_at, profiles(full_name)")
    .order("created_at", { ascending: true });

  // Any error here (missing table pre-migration, RLS) means the feature is not
  // usable yet: report unavailable and render the graceful state.
  if (error) return { available: false, messages: [] };

  const rows = (data ?? []) as unknown as Row[];
  return {
    available: true,
    messages: rows.map((r) => ({
      id: r.id,
      body: r.body,
      sender_role: r.sender_role,
      sender_name: r.profiles?.full_name ?? null,
      created_at: r.created_at,
      mine: r.sender_id === user.id,
    })),
  };
}
