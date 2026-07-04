"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

export type ToggleActionState = { error: string | null };

const schema = z.object({
  actionId: z.string().uuid(),
  done: z.boolean(),
});

/**
 * Tick or untick one of the client's own "This week's focus" actions.
 *
 * Server-authoritative: verifies the caller is a client, resolves their client
 * row, and confirms the action is a client-visible, non-flag action that belongs
 * to them before writing. Writes go through the service role (RLS has no client
 * write policy), matching setConsent, and are audited.
 *
 * Staged: the client_action_checks table ships in migration 0016. Until it is
 * applied the write returns a friendly error and the caller reverts its optimistic
 * state; the actions simply are not tickable yet (see ClientActions). The table
 * is not yet in the generated types, hence the untyped-client cast below; switch
 * to the typed client after regenerating types.
 */
export async function toggleAction(actionId: string, done: boolean): Promise<ToggleActionState> {
  const parsed = schema.safeParse({ actionId, done });
  if (!parsed.success) return { error: "That action could not be updated." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "client") {
    return { error: "Only clients can update their actions." };
  }

  const admin = getAdminClient();

  const { data: clientRow } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!clientRow) return { error: "No client record found." };

  // Confirm the action belongs to this client and is a client-visible, non-flag
  // action (never let a client tick a safety flag or someone else's action).
  const { data: action } = await admin
    .from("actions_flags")
    .select("id, client_visible, is_flag, review_id")
    .eq("id", parsed.data.actionId)
    .maybeSingle();
  if (!action || !action.client_visible || action.is_flag) {
    return { error: "That action is not available." };
  }

  const { data: review } = await admin
    .from("weekly_reviews")
    .select("client_id")
    .eq("id", action.review_id)
    .maybeSingle();
  if (!review || review.client_id !== clientRow.id) {
    return { error: "That action does not belong to you." };
  }

  const staged = admin as unknown as SupabaseClient;
  if (parsed.data.done) {
    const { error } = await staged
      .from("client_action_checks")
      .upsert(
        { action_id: parsed.data.actionId, client_id: clientRow.id },
        { onConflict: "action_id" },
      );
    if (error) return { error: "Could not save that just now. Please try again." };
  } else {
    const { error } = await staged
      .from("client_action_checks")
      .delete()
      .eq("action_id", parsed.data.actionId);
    if (error) return { error: "Could not save that just now. Please try again." };
  }

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: parsed.data.done ? "action.checked" : "action.unchecked",
    entity: "actions_flags",
    entity_id: parsed.data.actionId,
    meta: { client_id: clientRow.id },
  });

  revalidatePath("/app");
  return { error: null };
}
