import "server-only";
import { z } from "zod";

/*
 * Server-side environment validation for the clinical platform.
 * Server-only — never import in Client Components or browser code.
 *
 * IMPORTANT (Cloudflare Workers): the environment MUST be read inside a request,
 * never at module scope. On Workers, secrets and vars are bound per-request and
 * are absent at global/module-evaluation time. Validating at import would fail
 * spuriously and 500 every route that imports this file. This is the same
 * reason admin.ts and server.ts read process.env inside their handlers. The
 * `env` proxy below defers the parse to first property access, which always
 * happens within a request.
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

  // Resend — transactional email for invites (optional until invites go live).
  RESEND_API_KEY: opt,
  RESEND_FROM_EMAIL: z.string().email().default("team@engelahealth.com"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/**
 * Validate and cache the environment on first use. Runs lazily so it only ever
 * executes inside a request, where process.env is populated. On a genuine
 * misconfiguration it logs and falls back to the raw environment rather than
 * throwing, so one bad value cannot take a route down.
 */
function resolveEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    return process.env as unknown as Env;
  }
  cached = parsed.data;
  return cached;
}

/**
 * Server-only, lazily-validated environment. Access properties inside request
 * handlers only (server actions, route handlers, server components at request
 * time) — never at module scope.
 */
export const env = new Proxy({} as Env, {
  get(_target, prop: string | symbol) {
    return resolveEnv()[prop as keyof Env];
  },
});
