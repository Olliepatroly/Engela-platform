# Changelog

Newest first. Every change records: what, why, files, and any migration/secret/DNS implication.

## 2026-07-01 — Phase 0: project scaffold

**What:** Stood up the `engela-platform` project (consultant console + client app + role-aware
sign-in) as a separate codebase from the marketing site.

- Tooling: `package.json` (pnpm), `tsconfig.json` (strict), ESLint + Prettier, Vitest, `.nvmrc` (22).
- Hosting: `next.config.ts` (security headers + always-noindex, since the whole surface is private),
  `open-next.config.ts`, `wrangler.jsonc` (`engela-platform`, `nodejs_compat`), CI + deploy workflows.
- Brand: `src/styles/tokens.css` — the demo's clinical brand (Slate/Amber/Navy/Cream, Fraunces +
  Hanken Grotesk, status colours). `globals.css` reset/base. `layout.tsx` loads both fonts.
- Data layer: `lib/env.ts` (Zod boot validation), `lib/supabase/{client,server,admin,middleware}.ts`,
  `lib/roles.ts`, hand-authored `types/database.types.ts` placeholder.
- Auth skeleton: `src/middleware.ts` (session refresh + role gate — `/console` clinical, `/app`
  clients, unauth → `/signin`). Placeholder routes `/`, `/signin`, `/console`, `/app`, `/invite/[token]`.
- Database: `supabase/migrations/0001_init.sql` — full schema + RLS deny-by-default + clinical-team
  access policies + role/care-team helper functions. `supabase/seed.sql` seeds `metrics_catalog`
  reference data (the 12 metric definitions).
- Docs: project `CLAUDE.md`, `README.md`, `docs/SETUP.md`.

**Why:** Phase 0 foundations per the build brief §12 — a buildable, deployable skeleton with the
brand system, Supabase wiring, auth gate and RLS baseline, ready for Phase 1 (functional sign-in +
console read-only + client home).

**Migration/secret/DNS implications:** Requires Oliver to provision (see `docs/SETUP.md`): a new
Supabase project (EU/London), a GitHub repo, Cloudflare account/token secrets, and the
`app.engelahealth.co.uk` DNS record. No secrets committed.
