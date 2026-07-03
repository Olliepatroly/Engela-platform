# Changelog

Newest first. Every change records: what, why, files, and any migration/secret/DNS implication.

## 2026-07-03 — Scoring engine, per-client goals, correctable back-dateable entries, chart fixes

**What:**
- **Scoring engine** (`src/features/console/scoring.ts`): each metric scores 0 to 10 from
  60% on-target (latest reading vs effective target: in target 10, near miss 6.5, outside 3) and
  40% consistency (share of recent readings inside the target). Pillar = mean of its metrics;
  composite = mean of pillars; review status = worst metric status. Recomputed automatically on
  every reading, correction and goal change.
- **Per-client goals** (`client_metric_targets`, migration `0010`): the care team adjusts a
  metric's goal for one client from the console ("Adjust a goal": at or above / at or below /
  between). The latest reading is reassessed, scores recompute, the console labels the override
  "(goal set for this client)", and the client app's target zone follows it. Audited
  (`metric_goal.set`).
- **Data entry**: readings carry a date and time (`metric_readings.recorded_at`, back-dateable
  after a session or test), and a correction mode replaces the most recent entry after a faulty
  input instead of appending (audited as `metric_reading.corrected`).
- **Activity sessions goal fixed**: one activity a day, so at or above 6 per week (was a
  placeholder of 18). Michael Mercer's history adjusted to match.
- **Chart overlap fixes**: the target-zone label moved bottom-left inside the band (skipped when
  the band is too thin), the latest-value callout flips below the point near the top edge, and
  Y-axis extents pin to the plot edges.

**Verified live:** VO2 max goal set to "at or above 50" flipped the reading to on track and
recomputed scores (composite 8.0 to 8.1, immune 7.1 to 7.5); a deliberately faulty grip strength
of 99 was corrected to 54 and vanished from the stored history; recorded_at persisted from the
picker; audit trail shows recorded / corrected / goal-set entries.

**Migration implication:** migration `0010` applied (new table + column + catalogue target
update + client payload change).

## 2026-07-02 — Drill-downs, The community, physio role, create-account, nav fix

**What:**
- **Sidebar fix**: the console rail is now fixed to the viewport inside a width-reserving holder,
  so it always runs the full height of the screen (no blank strip below) and stays in place while
  the page scrolls.
- **Metric drill-down on both surfaces** (`components/ui/MetricDetail*`): clicking a console
  metric row or a client metric card opens an enlarged view with the 12-week trend against a
  shaded target zone, the latest value called out, and "Why we track this" education copy (new
  `metrics_catalog.why_it_matters`, seeded for all 12 metrics; client payload now carries history,
  target and copy — migration `0008`). Client modals keep softened statuses; never red.
- **The community** (`/app/community`): the client's team presented as their community, warm and
  premium rather than clinical. Sharing (consent) moved here: "Following your progress" / "Pause
  sharing", still database-enforced. Account page slims to personal settings.
- **New clinicians**: Dr Priya Sharma (Consultant Oncologist) and Tom Whitfield (Physiotherapist).
  New `physio` role added to the enum, `is_clinical()`, and the app's role model (migration
  `0009`). Both added to care teams (Michael Mercer plus one other each).
- **Create an account** (`/create-account`, linked from sign-in): two paths (clinical team /
  starting my programme), both explaining invite-only access with a request form as a foundation
  (requests are not sent anywhere yet).

**Verified:** physio login shows exactly his two care-team patients; the rail covers the full
viewport when scrolled to the page bottom; drill-downs render on console (Resting HR) and client
(Sleep: amber focus, estimate chip, 7 to 9 target band); community lists all four members with
working sharing controls.

**Migration implication:** migrations `0008`, `0009` applied to the live DB.

## 2026-07-02 — Interactive demo: data entry, consent, collapsible nav, accounts

**What:**
- **Collapsible sidebar** (`src/features/console/Sidebar.tsx`): the console's roster rail is now a
  permanent left navigation (Weekly review, My account, roster, sign out) that collapses to a slim
  rail of initials; the choice persists per browser.
- **Clinician data entry** (`entry-actions.ts`, `AddDataPanel.tsx`): consultants and CEPs record
  metric readings (status computed against the catalog target, history appended, previous/delta
  maintained) and add actions or safety flags. A safety flag is forced non-client-visible in the
  server action. Authorisation is the caller's own RLS view of the client (care team + consent);
  writes use the service role and every entry is appended to audit_log.
- **Reports foundation** (`ReportsPanel.tsx`): PDF picker above Sign-off, explicitly non-functional
  (no storage, nothing leaves the browser) until a later phase.
- **Account editor** (`src/features/account/`): /console/account and /app/account. Everyone edits
  name and password; clinicians edit discipline/registration. Name changes propagate to the auth
  metadata copy and are audited.
- **Client consent manager**: clients see their care team and grant/withdraw consent per
  clinician. Enforced in the database: `is_on_care_team()` now requires `consent_at` (migration
  `0006`), so withdrawal removes the clinician's access everywhere, immediately. Clients read
  their team via a narrow `my_care_team()` SECURITY DEFINER helper (migration `0007`).
- All four demo patients can now sign in (shared demo password).

**Verified live against the real DB:** consultant recorded a grip-strength reading for Beatrice
Cole (status computed "watch") and raised a safety flag (forced clinical-only); both audit_log
entries present; the reading appeared in Beatrice's client app softened to "Worth watching";
Beatrice withdrew consent for the consultant and the consultant's REST view of her record went
empty, then restored on re-grant; account edits persisted and were reverted.

**Migration/secret implication:** migrations `0006`, `0007` applied. `SUPABASE_SERVICE_ROLE_KEY`
uploaded as a Cloudflare Worker secret (server actions need it at runtime).

## 2026-07-02 — Phase 1: functional sign-in, consultant console, client home, demo data

**What:**
- **Sign-in** (`src/features/auth/`): email/password via Supabase Auth with a shared Zod schema,
  server action sets the session and routes by the role claim (clinical → /console, client → /app).
- **Consultant console** (`src/features/console/`): navy roster rail (care-team scoped by RLS),
  patient banner, clinical status strip (diagnosis, phase, MRD, QOL, sessions), composite + pillar
  score cards (amber below 8.0), per-pillar metric tables with 12-week SVG sparklines, targets,
  estimate chips and colour+dot+text status pills, actions/flags panel (flags styled red,
  consultant-only; actions tagged "Shared with client" or "Clinical team only"), read-only
  sign-off block (audited sign-off is Phase 2).
- **Client home** (`src/features/client-home/`): phone-first calm hero with composite ring, three
  pillar cards vs baseline, "This week's focus" (client-visible actions only), "Your numbers"
  (client-labelled metrics only, estimate caveats, flag softened to amber "This week's focus" —
  red never reaches the client surface). Data comes exclusively from a new SECURITY DEFINER
  projection `client_home_payload()` (migration `0005`); clients still have no direct SELECT on
  review tables.
- **Demo data + accounts** (`supabase/seed_demo.sql`): worked example Michael Mercer
  (HCA-MM-0142, week 32, composite 8.0, sleep flag + raised CRP) with 12 readings and histories,
  labs panel, actions; three roster patients; demo sign-ins for consultant (Dr Emily Hartley),
  CEP (Daniel Ross, on one care team only — demonstrates least disclosure) and client.
- Shared UI (`src/components/ui/`): StatusPill (never colour alone) and Sparkline.

**Verified:** all three demo accounts signed in live against the real database; CEP roster
correctly limited to one patient; client REST probes against weekly_reviews, labs and another
client's record all refused by RLS (the Phase 1 gate); client page render contains no MRD, CRP,
neutrophil, diagnosis or flag content.

**Migration/secret/DNS implication:** migration `0005_client_home_payload.sql` applied to the live
DB. Demo accounts share password EngelaDemo2026! — rotate or delete before any real client data.
Domain attach to the Worker still pending removal of two Namecheap parking DNS records (A @ apex,
CNAME www) in the engelahealth.com zone.

## 2026-07-02 — Backend wired up: GitHub, Cloudflare, Supabase live

**What:**
- Connected the repo to GitHub (`Olliepatroly/Engela-platform`, private) and pushed `main`.
- Set GitHub Actions secrets (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`); CI and Deploy
  workflows are green, production Worker is live at the `workers.dev` subdomain.
- Connected the Supabase MCP server (`.mcp.json`) to the `Engela-platform` project
  (`hsxhylmheonlcmsjlffy`) and applied the schema: `0001_init.sql` as originally authored, plus
  three follow-up hardening migrations found via the security/performance advisors —
  `0002_harden_function_grants.sql` and `0003_revoke_anon_function_grants.sql` (Postgres/Supabase
  both grant `EXECUTE` on new functions to `anon`/`authenticated`/`PUBLIC` by default; the
  SECURITY DEFINER role-check helpers had no legitimate anon caller, so that default grant is now
  revoked from `anon`), and `0004_rls_initplan_perf.sql` (wrap `auth.uid()` in a subselect in three
  policies per Supabase's RLS perf guidance — no security change). `metrics_catalog` seeded (12
  rows). Regenerated `src/types/database.types.ts` from the live schema, replacing the hand-authored
  placeholder.
- Added `.claude/settings.local.json` to `.gitignore` — it was recording full command lines
  (including Cloudflare API tokens) in its permission allowlist; caught before anything was
  committed.

**Why:** Get the Phase 0 "preview deploy live" gate genuinely live end to end, and give Phase 1
a real, RLS-protected schema to build against instead of a placeholder.

**Migration/secret/DNS implication:** Live DB now has real RLS-protected tables (all empty except
`metrics_catalog`). Region is `eu-west-1` (Ireland) — CLAUDE.md's decision log specifies EU/London;
flagged to Oliver as unresolved (region is immutable post-creation). Domain `engelahealth.com` is
an active Cloudflare zone but not yet attached to the Worker — still on the `workers.dev` URL.
Supabase DPA still needs signing before real patient data goes in.

## 2026-07-01 — Domain set to engelahealth.com

**What:** Pointed the platform at **engelahealth.com** (apex) instead of a subdomain of the
marketing domain. Oliver owns `engelahealth.com` as a distinct TLD; it is dedicated to the platform.
Updated `NEXT_PUBLIC_SITE_URL` (env, env.ts, CI, deploy), `RESEND_FROM_EMAIL` → `team@engelahealth.com`,
and docs. `NEXT_PUBLIC_MARKETING_URL` still points at `engelahealth.co.uk` (the separate marketing site).

**DNS implication:** add `engelahealth.com` as a Cloudflare zone and attach the apex to the Worker;
add Resend SPF/DKIM records to that zone before Phase 2 invites. See `docs/SETUP.md`.

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
`engelahealth.com` DNS/zone. No secrets committed.
