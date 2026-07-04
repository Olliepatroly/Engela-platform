"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

export type SendMessageState = { error: string | null; ok: boolean };

const schema = z.object({
  body: z.string().trim().min(1, "Write a message first.").max(4000, "That message is too long."),
});

/**
 * Send a message from the client to their care team.
 *
 * Server-authoritative: verifies the caller is a client, resolves their client
 * row, and stamps sender_id/sender_role. Writes go through the service role (RLS
 * has no client write policy), and the send is audited (scoped to the client, no
 * message body in the audit meta).
 *
 * Staged: the messages table ships in migration 0017; until then the insert
 * errors and the caller sees a friendly message. Untyped-client cast because the
 * table is not yet in the generated types.
 */
export async function sendMessage(
  _prev: SendMessageState,
  formData: FormData,
): Promise<SendMessageState> {
  const parsed = schema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your message.", ok: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "client") {
    return { error: "Only clients can send from here.", ok: false };
  }

  const admin = getAdminClient();
  const { data: clientRow } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!clientRow) return { error: "No client record found.", ok: false };

  const staged = admin as unknown as SupabaseClient;
  const { data: inserted, error } = await staged
    .from("messages")
    .insert({
      client_id: clientRow.id,
      sender_id: user.id,
      sender_role: "client",
      body: parsed.data.body,
    })
    .select("id")
    .single();
  if (error) return { error: "Could not send that just now. Please try again.", ok: false };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "message.sent",
    entity: "messages",
    entity_id: (inserted as { id: string } | null)?.id ?? null,
    meta: { client_id: clientRow.id },
  });

  revalidatePath("/app/community/messages");
  return { error: null, ok: true };
}
