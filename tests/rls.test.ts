/**
 * RLS verification against the live Supabase project, replacing the manual
 * REST checks done by hand each session. Read-only: signs in as demo accounts
 * and asserts what each role can and cannot see.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
 * DEMO_PASSWORD (the shared demo-account password), read from the environment
 * or .env.local. The whole suite skips when they are absent (e.g. in CI
 * without secrets), so `pnpm test` stays green anywhere.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

function loadEnvLocal(): void {
  const file = path.resolve(__dirname, "../.env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (key && value && process.env[key] == null) process.env[key] = value;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const demoPassword = process.env.DEMO_PASSWORD;
const configured = Boolean(url && anonKey && demoPassword);

function anonClient(): SupabaseClient {
  return createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signedInClient(email: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: demoPassword! });
  if (error) throw new Error(`Could not sign in ${email}: ${error.message}`);
  return client;
}

const MICHAEL_MRN = "HCA-MM-0142";
const LEO_MRN = "HCA-LY-0011";

describe.skipIf(!configured)("RLS on the live project", () => {
  it("a client sees exactly their own client record", async () => {
    const michael = await signedInClient("demo.client@engelahealth.com");
    const { data, error } = await michael.from("clients").select("mrn");
    expect(error).toBeNull();
    expect(data?.map((r) => r.mrn)).toEqual([MICHAEL_MRN]);
    await michael.auth.signOut();
  });

  it("a client gets nothing from clinical tables, even their own rows", async () => {
    const michael = await signedInClient("demo.client@engelahealth.com");
    // weekly_reviews.context holds disease markers; labs are consultant-only;
    // readings and flags reach the client only through the safe projection.
    for (const table of [
      "weekly_reviews",
      "metric_readings",
      "pillar_scores",
      "actions_flags",
      "labs",
      "audit_log",
      "invites",
      "account_requests",
    ]) {
      const { data } = await michael.from(table).select("*").limit(5);
      expect(data, `client should read nothing from ${table}`).toEqual([]);
    }
    await michael.auth.signOut();
  });

  it("the client-safe projection works and carries no disease markers", async () => {
    const michael = await signedInClient("demo.client@engelahealth.com");
    const { data, error } = await michael.rpc("client_home_payload");
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    const payload = JSON.stringify(data).toLowerCase();
    expect(payload).not.toContain("mrd");
    expect(payload).not.toContain("diagnosis");
    await michael.auth.signOut();
  });

  it("one client cannot see another client's record", async () => {
    const beatrice = await signedInClient("demo.patient2@engelahealth.com");
    const { data } = await beatrice.from("clients").select("mrn");
    expect(data?.map((r) => r.mrn)).not.toContain(MICHAEL_MRN);
    await beatrice.auth.signOut();
  });

  it("a clinician sees consented care-team clients only", async () => {
    // Demo state from the Phase 1 handover: Daniel Ross (CEP) is on Michael's
    // team with consent, and on Leo Yates's team with sharing paused
    // (consent_at null). If that demo state is ever reset, update this test.
    const daniel = await signedInClient("demo.cep@engelahealth.com");
    const { data } = await daniel.from("clients").select("mrn");
    const mrns = data?.map((r) => r.mrn) ?? [];
    expect(mrns).toContain(MICHAEL_MRN);
    expect(mrns, "consent paused: Leo must stay invisible").not.toContain(LEO_MRN);
    await daniel.auth.signOut();
  });

  it("the audit trail hides events about clients outside the consented care team", async () => {
    // A clinician's audit view is scoped (0015): own actions, plus rows about
    // consented care-team clients. Daniel (CEP) has Michael consented and Leo
    // paused, so no Leo-scoped audit row should ever reach him.
    const daniel = await signedInClient("demo.cep@engelahealth.com");
    const {
      data: { user },
    } = await daniel.auth.getUser();
    const { data: visible } = await daniel.from("clients").select("id");
    const visibleIds = new Set((visible ?? []).map((c) => c.id));

    const { data: rows } = await daniel
      .from("audit_log")
      .select("actor_id, entity, entity_id, meta")
      .limit(1000);

    for (const row of rows ?? []) {
      const meta = (row.meta ?? {}) as Record<string, unknown>;
      const clientId =
        typeof meta.client_id === "string"
          ? meta.client_id
          : row.entity === "care_team"
            ? row.entity_id
            : null;
      if (clientId && row.actor_id !== user?.id) {
        expect(
          visibleIds.has(clientId),
          "audit row references a client Daniel cannot see",
        ).toBe(true);
      }
    }
    await daniel.auth.signOut();
  });

  it("a client cannot write to clinical tables", async () => {
    const michael = await signedInClient("demo.client@engelahealth.com");
    const { error } = await michael
      .from("audit_log")
      .insert({ action: "test.blocked", entity: "audit_log", meta: {} });
    expect(error, "audit_log insert must be refused").not.toBeNull();
    await michael.auth.signOut();
  });

  it("anonymous visitors get nothing at all", async () => {
    const anon = anonClient();
    for (const table of [
      "clients",
      "profiles",
      "weekly_reviews",
      "invites",
      "account_requests",
      "client_action_checks",
      "messages",
      "clinical_flags",
      "client_health_profiles",
    ]) {
      const { data } = await anon.from(table).select("*").limit(5);
      expect(data ?? [], `anon should read nothing from ${table}`).toEqual([]);
    }
  });

  it("Phase 3 tables: a client sees only their own rows, never another client's", async () => {
    // Own-scoping on the new tables (0016-0019). Beatrice reads them as
    // herself: whatever comes back must reference only her own client id.
    const beatrice = await signedInClient("demo.patient2@engelahealth.com");
    const { data: own } = await beatrice.from("clients").select("id");
    const ownIds = new Set((own ?? []).map((c) => c.id));

    for (const table of [
      "client_action_checks",
      "messages",
      "clinical_flags",
      "client_health_profiles",
    ]) {
      const { data, error } = await beatrice.from(table).select("client_id").limit(100);
      expect(error, `select on ${table} should not error`).toBeNull();
      for (const row of data ?? []) {
        expect(ownIds.has(row.client_id), `${table} row leaks another client`).toBe(true);
      }
    }
    await beatrice.auth.signOut();
  });

  it("Phase 3 tables: a client cannot write directly (server-only writes)", async () => {
    const michael = await signedInClient("demo.client@engelahealth.com");
    const { data: own } = await michael.from("clients").select("id").single();

    const attempts: { table: string; row: Record<string, unknown> }[] = [
      { table: "messages", row: { client_id: own!.id, sender_id: "x", sender_role: "client", body: "hi" } },
      { table: "clinical_flags", row: { client_id: own!.id, raised_by: "x", raised_role: "client", tier: "minor", transcript: "t" } },
      { table: "client_health_profiles", row: { client_id: own!.id } },
    ];
    for (const attempt of attempts) {
      const { error } = await michael.from(attempt.table).insert(attempt.row);
      expect(error, `${attempt.table} direct insert must be refused`).not.toBeNull();
    }
    await michael.auth.signOut();
  });

  it("a client never sees clinician-raised flags about them, only their own concerns", async () => {
    // Load-bearing (CLAUDE.md §2): a clinician's flag is a safety flag and
    // must not reach the client. The policy limits a client to rows where
    // they are the raiser.
    const michael = await signedInClient("demo.client@engelahealth.com");
    const {
      data: { user },
    } = await michael.auth.getUser();
    const { data } = await michael.from("clinical_flags").select("raised_by, raised_role");
    for (const row of data ?? []) {
      expect(row.raised_by, "client can only see flags they raised").toBe(user?.id);
      expect(row.raised_role).toBe("client");
    }
    await michael.auth.signOut();
  });

  it("the voice-notes bucket refuses direct client access", async () => {
    const michael = await signedInClient("demo.client@engelahealth.com");
    const { data: listed } = await michael.storage.from("voice-notes").list();
    expect(listed ?? [], "bucket listing should be empty for clients").toEqual([]);
    const { error: uploadError } = await michael.storage
      .from("voice-notes")
      .upload("intruder/test.webm", new Blob(["x"], { type: "audio/webm" }));
    expect(uploadError, "direct upload must be refused").not.toBeNull();
    await michael.auth.signOut();
  });
});

describe.skipIf(configured)("RLS suite (skipped)", () => {
  it("skips without Supabase credentials and DEMO_PASSWORD", () => {
    expect(configured).toBe(false);
  });
});
