"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

export type AccountState = { error: string | null; success: string | null };

const nameSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
});

const clinicianSchema = z.object({
  discipline: z.string().trim().min(2, "Enter your discipline.").max(120),
  registrationNo: z.string().trim().max(120).optional(),
});

const passwordSchema = z.object({
  password: z.string().min(10, "Use at least 10 characters."),
});

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Update the caller's display name (shown to their care team / clients). */
export async function updateName(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const parsed = nameSchema.safeParse({ fullName: formData.get("fullName") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the name.", success: null };
  }

  const user = await requireUser();
  if (!user) return { error: "Your session has expired. Sign in again.", success: null };

  const admin = getAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", user.id);
  if (error) return { error: "Could not save your name. Try again.", success: null };

  // Keep the auth metadata copy in step (used for the header greeting).
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { full_name: parsed.data.fullName },
  });

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "profile.name_updated",
    entity: "profiles",
    entity_id: user.id,
    meta: {},
  });

  revalidatePath("/console");
  revalidatePath("/app");
  return { error: null, success: "Name updated." };
}

/** Update the caller's clinician details (clinical roles only). */
export async function updateClinicianDetails(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const parsed = clinicianSchema.safeParse({
    discipline: formData.get("discipline"),
    registrationNo: formData.get("registrationNo") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details.", success: null };
  }

  const user = await requireUser();
  const role = user?.app_metadata?.role;
  if (!user || !["consultant", "nurse", "cep", "admin"].includes(role)) {
    return { error: "Only clinical accounts can edit these details.", success: null };
  }

  const admin = getAdminClient();
  const { error } = await admin.from("clinicians").upsert({
    profile_id: user.id,
    discipline: parsed.data.discipline,
    registration_no: parsed.data.registrationNo || null,
  });
  if (error) return { error: "Could not save the details. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "clinician.details_updated",
    entity: "clinicians",
    entity_id: user.id,
    meta: {},
  });

  revalidatePath("/console/account");
  return { error: null, success: "Professional details updated." };
}

/** Change the caller's password (uses their own session, not the admin API). */
export async function changePassword(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const parsed = passwordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the password.", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Could not change the password. Try again.", success: null };
  return { error: null, success: "Password changed." };
}

/**
 * Grant or withdraw the caller's consent for one care-team clinician.
 * Withdrawing consent removes that clinician's access to the record
 * immediately (enforced in the database, not just the interface).
 */
export async function setConsent(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const clinicianId = z.string().uuid().safeParse(formData.get("clinicianId"));
  const grant = formData.get("grant") === "1";
  if (!clinicianId.success) return { error: "Unknown clinician.", success: null };

  const user = await requireUser();
  if (!user || user.app_metadata?.role !== "client") {
    return { error: "Only clients can manage consent.", success: null };
  }

  const admin = getAdminClient();
  const { data: clientRow } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!clientRow) return { error: "No client record found.", success: null };

  const { error } = await admin
    .from("care_team")
    .update({ consent_at: grant ? new Date().toISOString() : null })
    .eq("client_id", clientRow.id)
    .eq("clinician_id", clinicianId.data);
  if (error) return { error: "Could not update consent. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: grant ? "consent.granted" : "consent.withdrawn",
    entity: "care_team",
    entity_id: clientRow.id,
    meta: { clinician_id: clinicianId.data },
  });

  revalidatePath("/app/account");
  return {
    error: null,
    success: grant
      ? "Consent granted. They can now see your programme data."
      : "Consent withdrawn. They can no longer see your programme data.",
  };
}
