import "server-only";
import { z } from "zod";

/*
 * Server-side environment validation for the clinical platform.
 * Server-only — never import in Client Components or browser code.
 * Integration keys are optional in this Phase 0 scaffold; each is tightened to
 * required when the corresponding integration is wired up (invites in Phase 2).
 */

// Empty strings in .env files are parsed as "" not undefined — treat them as absent.
const opt = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());

const schema = z.object({
  // Site
  NEXT_PUBLIC_SITE_URL: z.string().url().default("https://engelahealth.com"),
  NEXT_PUBLIC_MARKETING_URL: z.string().url().default("https://engelahealth.co.uk"),
  NEXT_PUBLIC_ENVIRONMENT: z.enum(["production", "preview", "development"]).default("development"),

  // Supabase — SEPARATE project from the marketing site, EU/London region.
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: opt,

  // Resend — transactional email for invites (tighten to required in Phase 2).
  RESEND_API_KEY: opt,
  RESEND_FROM_EMAIL: z.string().email().default("team@engelahealth.com"),
});

// Cloudflare Workers secrets are injected at runtime, not during `next build`.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  if (isBuildPhase) {
    console.warn(
      "⚠ Runtime secrets unavailable during build (expected for Cloudflare Workers):",
      Object.keys(parsed.error.flatten().fieldErrors).join(", "),
    );
  } else {
    console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables — check server logs for details.");
  }
}

export const env = (parsed.data ?? process.env) as z.infer<typeof schema>;
