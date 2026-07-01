# Engela Health — Clinical Platform

The authenticated product behind the Engela Health sign-in: a **consultant console** (desktop) and
a **client app** (phone-first), on a Supabase backend. Lives at **app.engelahealth.co.uk**.

The public marketing site is a **separate project** (`../engela-health`, engelahealth.co.uk).

> Special-category (UK GDPR Art. 9) health data. Security, least-disclosure and consent are core
> requirements. Read `CLAUDE.md` before working in this repo; read `docs/SETUP.md` for provisioning.

## Stack

Next.js (App Router, TypeScript strict) · CSS Modules + design tokens · Supabase (Postgres + RLS +
Auth) · Cloudflare Workers via OpenNext · pnpm · Fraunces + Hanken Grotesk.

## Local development

```bash
pnpm install
cp .env.example .env.local   # fill in the Supabase values once the project exists
pnpm dev                     # http://localhost:3000
```

## Quality gate (run before every commit)

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm audit
pnpm exec opennextjs-cloudflare build   # verify the Worker still builds
```

## Database

```bash
pnpm exec supabase db push                                   # apply migrations to the linked project
pnpm exec supabase db query --file supabase/seed.sql         # seed reference/sample data
pnpm db:types                                                # regenerate src/types/database.types.ts
```

Migrations live in `supabase/migrations/` and are **append-only**. RLS is enabled deny-by-default on
every table; see `supabase/migrations/0001_init.sql` for the policies and the RLS golden rules.

## Status

**Phase 0 — Foundations** (scaffold). See `CLAUDE.md` §5 for the phase plan and `CHANGELOG.md` for
what has shipped.
