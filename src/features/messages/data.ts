import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The client / care-team message thread. Reads go through the RLS server client
 * (cookie-scoped), so the client only ever sees their own thread; the SELECT
 * policy also lets the consented care team read it. Backed by the messages
 * table (migration 0017, applied live); `available` stays so the UI degrades
 * gracefully if the read ever fails.
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

  const { data, error } = await supabase
    .from("messages")
    .select("id, body, sender_role, sender_id, created_at, profiles(full_name)")
    .order("created_at", { ascending: true });

  // Any error means the feature is not usable right now: report unavailable
  // and render the graceful state rather than breaking the page.
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
