import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The client app reads ONLY the client-safe projection returned by the
 * SECURITY DEFINER function client_home_payload(): no raw labs, no disease
 * markers, no safety flags, and any 'flag' status arrives pre-softened to
 * 'focus'. Direct table access for clients is denied by RLS.
 */
export type ClientHomeVM = {
  client: { first_name: string; programme_week: number | null; status: string };
  review: { week_no: number; window_end: string; composite_score: number | null } | null;
  pillars: { pillar: "exercise" | "nutrition" | "immune"; score: number; baseline: number | null }[];
  metrics: {
    code: string;
    label: string;
    pillar: "exercise" | "nutrition" | "immune";
    current: number | null;
    previous: number | null;
    unit: string | null;
    is_estimate: boolean;
    status: "on_track" | "watch" | "focus" | null;
    history: number[];
    target_def: { kind: "floor"; value: number } | { kind: "ceiling"; value: number } | { kind: "range"; min: number; max: number } | null;
    why_it_matters: string | null;
  }[];
  actions: { id: string; text: string }[];
};

export async function getClientHome(): Promise<ClientHomeVM | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("client_home_payload");
  if (error || data == null) return null;
  return data as unknown as ClientHomeVM;
}
