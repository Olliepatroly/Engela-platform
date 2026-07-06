"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { PARQ_QUESTIONS, type ParqAnswers } from "./parq";

export type ParqState = { error: string | null; done: boolean };

/**
 * Store the client's PAR-Q answers on their health profile. Every question
 * must be answered yes or no; any yes marks the screening positive so the
 * team follows up before the next session. Service-role upsert (no client
 * write policy), audited without the answers themselves in the meta.
 */
export async function submitParq(_prev: ParqState, formData: FormData): Promise<ParqState> {
  const answers: ParqAnswers = {};
  for (const q of PARQ_QUESTIONS) {
    const value = formData.get(q.code);
    if (value !== "yes" && value !== "no") {
      return { error: "Please answer every question yes or no.", done: false };
    }
    answers[q.code] = value === "yes";
  }
  const positive = Object.values(answers).some(Boolean);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "client") {
    return { error: "Only clients can complete this screening.", done: false };
  }

  const admin = getAdminClient();
  const { data: clientRow } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!clientRow) return { error: "No client record found.", done: false };

  const { error } = await admin.from("client_health_profiles").upsert(
    {
      client_id: clientRow.id,
      parq: { answers, version: "parq-7-v1" },
      parq_completed_at: new Date().toISOString(),
      parq_positive: positive,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" },
  );
  if (error) return { error: "Could not save your answers. Try again.", done: false };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "parq.completed",
    entity: "client_health_profiles",
    entity_id: clientRow.id,
    meta: { client_id: clientRow.id, positive },
  });

  revalidatePath("/app");
  revalidatePath("/app/account");
  return { error: null, done: true };
}
