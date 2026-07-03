"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { Constants, type Database } from "@/types/database.types";

export type ProgramActionState = { error: string | null; success: string | null };

type ExerciseCategory = Database["public"]["Enums"]["exercise_category"];
type MuscleGroup = Database["public"]["Enums"]["muscle_group"];

const MUSCLES = Constants.public.Enums.muscle_group;
const CATEGORIES = Constants.public.Enums.exercise_category;

/** Programme building is a CEP capability (admin included). Other clinical
 * roles read programmes; they do not write them. */
async function requireBuilder() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;
  if (!user || (role !== "cep" && role !== "admin")) return null;
  return user;
}

/** RLS as the authorisation check: the builder must be able to see the client
 * (care team with consent), same pattern as the weekly-review data entry. */
async function builderCanSeeClient(clientId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
  return data != null;
}

function musclesFrom(formData: FormData, field: string): MuscleGroup[] {
  return formData
    .getAll(field)
    .map(String)
    .filter((m): m is MuscleGroup => (MUSCLES as readonly string[]).includes(m));
}

const exerciseSchema = z.object({
  name: z.string().trim().min(2, "Give the exercise a name.").max(120),
  category: z.enum(CATEGORIES),
  equipment: z.string().trim().max(120).optional(),
  instructions: z.string().trim().max(600).optional(),
});

/** Add an exercise to the shared library (CEP/admin only). */
export async function addExerciseToLibrary(
  _prev: ProgramActionState,
  formData: FormData,
): Promise<ProgramActionState> {
  const parsed = exerciseSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    equipment: formData.get("equipment") || undefined,
    instructions: formData.get("instructions") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the exercise details.", success: null };
  }
  const primary = musclesFrom(formData, "primaryMuscles");
  const secondary = musclesFrom(formData, "secondaryMuscles").filter((m) => !primary.includes(m));
  if (primary.length === 0) {
    return { error: "Pick at least one primary muscle group.", success: null };
  }

  const user = await requireBuilder();
  if (!user) return { error: "Only exercise physiologists can add exercises.", success: null };

  const admin = getAdminClient();
  const { data: inserted, error } = await admin
    .from("exercises")
    .insert({
      name: parsed.data.name,
      category: parsed.data.category,
      primary_muscles: primary,
      secondary_muscles: secondary,
      equipment: parsed.data.equipment || null,
      instructions: parsed.data.instructions || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !inserted) return { error: "Could not save the exercise. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "exercise.added",
    entity: "exercises",
    entity_id: inserted.id,
    meta: { name: parsed.data.name, category: parsed.data.category },
  });

  revalidatePath("/console/programs");
  return { error: null, success: `${parsed.data.name} added to the exercise library.` };
}

const programSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().trim().min(2, "Give the block a title.").max(120),
  focus: z.string().trim().max(300).optional(),
  startsOn: z.string().optional(),
});

/** Create a programme for a client (CEP/admin, care team with consent). */
export async function createProgram(
  _prev: ProgramActionState,
  formData: FormData,
): Promise<ProgramActionState> {
  const parsed = programSchema.safeParse({
    clientId: formData.get("clientId"),
    title: formData.get("title"),
    focus: formData.get("focus") || undefined,
    startsOn: formData.get("startsOn") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the block details.", success: null };
  }

  const user = await requireBuilder();
  if (!user || !(await builderCanSeeClient(parsed.data.clientId))) {
    return { error: "You do not have access to this client.", success: null };
  }

  const admin = getAdminClient();
  // One active programme per client keeps both surfaces unambiguous.
  await admin
    .from("programs")
    .update({ status: "archived" })
    .eq("client_id", parsed.data.clientId)
    .eq("status", "active");

  const { data: inserted, error } = await admin
    .from("programs")
    .insert({
      client_id: parsed.data.clientId,
      title: parsed.data.title,
      focus: parsed.data.focus || null,
      starts_on: parsed.data.startsOn || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !inserted) return { error: "Could not create the block. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "program.created",
    entity: "programs",
    entity_id: inserted.id,
    meta: { client_id: parsed.data.clientId, title: parsed.data.title },
  });

  revalidatePath("/console/programs");
  revalidatePath("/app/program");
  return { error: null, success: "Block created. Add its first session below." };
}

const updateProgramSchema = z.object({
  programId: z.string().uuid(),
  title: z.string().trim().min(2, "Give the block a title.").max(120),
  focus: z.string().trim().max(300).optional(),
  startsOn: z.string().optional(),
  status: z.enum(["active", "completed", "archived"]),
});

/** Edit a block: title, focus, start date, status (CEP/admin). */
export async function updateProgram(
  _prev: ProgramActionState,
  formData: FormData,
): Promise<ProgramActionState> {
  const parsed = updateProgramSchema.safeParse({
    programId: formData.get("programId"),
    title: formData.get("title"),
    focus: formData.get("focus") || undefined,
    startsOn: formData.get("startsOn") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the block details.", success: null };
  }

  const user = await requireBuilder();
  if (!user) return { error: "Only exercise physiologists can edit blocks.", success: null };

  const admin = getAdminClient();
  const { data: program } = await admin
    .from("programs")
    .select("id, client_id")
    .eq("id", parsed.data.programId)
    .maybeSingle();
  if (!program || !(await builderCanSeeClient(program.client_id))) {
    return { error: "You do not have access to this client.", success: null };
  }

  // One active block per client keeps both surfaces unambiguous.
  if (parsed.data.status === "active") {
    await admin
      .from("programs")
      .update({ status: "archived" })
      .eq("client_id", program.client_id)
      .eq("status", "active")
      .neq("id", program.id);
  }

  const { error } = await admin
    .from("programs")
    .update({
      title: parsed.data.title,
      focus: parsed.data.focus || null,
      starts_on: parsed.data.startsOn || null,
      status: parsed.data.status,
    })
    .eq("id", program.id);
  if (error) return { error: "Could not save the block. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "program.updated",
    entity: "programs",
    entity_id: program.id,
    meta: { client_id: program.client_id, status: parsed.data.status },
  });

  revalidatePath("/console/programs", "layout");
  revalidatePath("/app/program");
  return { error: null, success: "Block updated." };
}

const sessionSchema = z.object({
  programId: z.string().uuid(),
  title: z.string().trim().min(2, "Give the session a title.").max(120),
  scheduledFor: z.string().min(10, "Pick a date for the session."),
});

/** Add a dated session to a programme (CEP/admin). */
export async function addSession(
  _prev: ProgramActionState,
  formData: FormData,
): Promise<ProgramActionState> {
  const parsed = sessionSchema.safeParse({
    programId: formData.get("programId"),
    title: formData.get("title"),
    scheduledFor: formData.get("scheduledFor"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the session details.", success: null };
  }

  const user = await requireBuilder();
  if (!user) return { error: "Only exercise physiologists can build programmes.", success: null };

  const admin = getAdminClient();
  const { data: program } = await admin
    .from("programs")
    .select("id, client_id")
    .eq("id", parsed.data.programId)
    .maybeSingle();
  if (!program || !(await builderCanSeeClient(program.client_id))) {
    return { error: "You do not have access to this client.", success: null };
  }

  const { data: inserted, error } = await admin
    .from("program_sessions")
    .insert({
      program_id: program.id,
      client_id: program.client_id,
      title: parsed.data.title,
      scheduled_for: parsed.data.scheduledFor,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !inserted) return { error: "Could not add the session. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "program_session.added",
    entity: "program_sessions",
    entity_id: inserted.id,
    meta: { client_id: program.client_id, scheduled_for: parsed.data.scheduledFor },
  });

  revalidatePath("/console/programs");
  revalidatePath("/app/program");
  return { error: null, success: "Session added. Open it to add exercises." };
}

const sessionExerciseSchema = z.object({
  sessionId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  sets: z.coerce.number().int().positive().max(20).optional(),
  reps: z.coerce.number().int().positive().max(100).optional(),
  weightKg: z.coerce.number().positive().max(500).optional(),
  durationMin: z.coerce.number().positive().max(600).optional(),
  distanceKm: z.coerce.number().positive().max(200).optional(),
  notes: z.string().trim().max(300).optional(),
});

/** Add an exercise (with the prescription) to a session (CEP/admin). */
export async function addSessionExercise(
  _prev: ProgramActionState,
  formData: FormData,
): Promise<ProgramActionState> {
  const parsed = sessionExerciseSchema.safeParse({
    sessionId: formData.get("sessionId"),
    exerciseId: formData.get("exerciseId"),
    sets: formData.get("sets") || undefined,
    reps: formData.get("reps") || undefined,
    weightKg: formData.get("weightKg") || undefined,
    durationMin: formData.get("durationMin") || undefined,
    distanceKm: formData.get("distanceKm") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the exercise entry.", success: null };
  }

  const user = await requireBuilder();
  if (!user) return { error: "Only exercise physiologists can build programmes.", success: null };

  const admin = getAdminClient();
  const { data: session } = await admin
    .from("program_sessions")
    .select("id, client_id")
    .eq("id", parsed.data.sessionId)
    .maybeSingle();
  if (!session || !(await builderCanSeeClient(session.client_id))) {
    return { error: "You do not have access to this client.", success: null };
  }

  const { count } = await admin
    .from("session_exercises")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id);

  const { data: inserted, error } = await admin
    .from("session_exercises")
    .insert({
      session_id: session.id,
      exercise_id: parsed.data.exerciseId,
      position: (count ?? 0) + 1,
      sets: parsed.data.sets ?? null,
      reps: parsed.data.reps ?? null,
      weight_kg: parsed.data.weightKg ?? null,
      duration_min: parsed.data.durationMin ?? null,
      distance_km: parsed.data.distanceKm ?? null,
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single();
  if (error || !inserted) return { error: "Could not add the exercise. Try again.", success: null };

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "session_exercise.added",
    entity: "session_exercises",
    entity_id: inserted.id,
    meta: { client_id: session.client_id, session_id: session.id },
  });

  revalidatePath("/console/programs");
  revalidatePath("/app/program");
  return { error: null, success: "Exercise added to the session." };
}

const categoryDoneSchema = z.object({
  sessionId: z.string().uuid(),
  category: z.enum(CATEGORIES),
  done: z.boolean(),
});

/**
 * Mark one part of a session done (cardiovascular, resistance or mobility,
 * each completed separately). The client does this themselves; a CEP or
 * physio on the care team can do it for them when they train together (the
 * audit trail records who). When every exercise is done the session completes.
 */
export async function setCategoryDone(
  _prev: ProgramActionState,
  formData: FormData,
): Promise<ProgramActionState> {
  const parsed = categoryDoneSchema.safeParse({
    sessionId: formData.get("sessionId"),
    category: formData.get("category"),
    done: formData.get("done") === "1",
  });
  if (!parsed.success) return { error: "Something went wrong. Try again.", success: null };
  const { sessionId, category, done } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;
  const isClient = role === "client";
  const isTrainer = role === "cep" || role === "physio" || role === "admin";
  if (!user || (!isClient && !isTrainer)) {
    return { error: "You cannot mark this session.", success: null };
  }

  const admin = getAdminClient();
  const { data: session } = await admin
    .from("program_sessions")
    .select("id, client_id, status, clients(profile_id)")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { error: "This session could not be found.", success: null };

  if (isClient && session.clients?.profile_id !== user.id) {
    return { error: "This session is not part of your programme.", success: null };
  }
  if (isTrainer) {
    // Care team with consent: the trainer's own RLS read is the check.
    const { data: visible } = await supabase
      .from("clients")
      .select("id")
      .eq("id", session.client_id)
      .maybeSingle();
    if (!visible) return { error: "You do not have access to this client.", success: null };
  }

  const { data: entries } = await admin
    .from("session_exercises")
    .select("id, completed_at, exercises(category)")
    .eq("session_id", sessionId);
  if (!entries || entries.length === 0) {
    return { error: "This session has no exercises yet.", success: null };
  }

  const inCategory = entries.filter((e) => e.exercises?.category === category);
  if (inCategory.length === 0) {
    return { error: "This session has no exercises in that part.", success: null };
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("session_exercises")
    .update({ completed_at: done ? now : null })
    .in(
      "id",
      inCategory.map((e) => e.id),
    );
  if (error) return { error: "Could not save that. Try again.", success: null };

  const allDone = entries.every((e) =>
    e.exercises?.category === category ? done : e.completed_at != null,
  );
  await admin
    .from("program_sessions")
    .update(
      allDone
        ? { status: "completed", completed_at: now }
        : { status: "scheduled", completed_at: null },
    )
    .eq("id", sessionId);

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: done ? "session_part.completed" : "session_part.reopened",
    entity: "program_sessions",
    entity_id: sessionId,
    meta: {
      client_id: session.client_id,
      category,
      session_complete: allDone && done,
      by_role: role,
    },
  });

  revalidatePath("/app/program");
  revalidatePath(`/app/program/${sessionId}`);
  revalidatePath("/console/programs", "layout");
  if (isClient) {
    return {
      error: null,
      success: done
        ? allDone
          ? "Wonderful. That completes the whole session."
          : "Nice work. That part is done."
        : "No problem, we have reopened that part.",
    };
  }
  return {
    error: null,
    success: done
      ? allDone
        ? "Marked done. That completes the whole session."
        : "Marked done for this client."
      : "Reopened.",
  };
}

export type { ExerciseCategory };
