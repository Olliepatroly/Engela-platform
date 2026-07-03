# Handover — 2026-07-03

Written for a fresh Claude Code session picking up this project on a new branch. Read
`CLAUDE.md` first (operating manual, non-negotiable rules) — this doc is "what's actually true
right now" on top of that. This file is a point-in-time snapshot; treat conflicts with the live
system, `CHANGELOG.md`, or `git log` as this file being stale, not the other way round.

## TL;DR

A working, demoable Phase 1 clinical platform is live at **https://engelahealth.com**. Real
Supabase backend, real RLS, real auth, three roles wired end to end (consultant, exercise
physiologist / physio, client), with clinician data entry, a computed scoring engine, per-client
goals, and a client-facing "community" (consent) surface. GitHub → Cloudflare Workers CI/CD is
green. Everything so far has been pushed directly to `main` (bootstrap circumstances, explicitly
OK'd turn by turn) — **going forward, use a feature branch + PR**, per `CLAUDE.md` §4.

## Live system

- **Production**: https://engelahealth.com (custom domain attached 2026-07-03) — also reachable
  at the Workers subdomain https://engela-platform.oliver-d0e.workers.dev
- **GitHub repo**: `Olliepatroly/Engela-platform` (private), `gh` CLI is authenticated as
  `Olliepatroly` in this environment
- **Supabase project**: "Engela-platform", ref `hsxhylmheonlcmsjlffy`, region `eu-west-1`
  (Ireland — see Open Items), connected via the Supabase MCP server (`.mcp.json`, project-scoped,
  already authorized in this environment)
- **Cloudflare**: account `d0ebd9bacf5a2c356b7d454657eff98a`, Worker `engela-platform`
  (production) + `engela-platform-preview` (PR previews), zone `engelahealth.com` active,
  custom domain attached to production

## Credentials / how to get back in

- Local secrets: `.env.local` (gitignored) has real Supabase URL/anon/service-role keys — already
  populated, just works.
- GitHub Actions secrets (already set): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- Cloudflare Worker secret (already set): `SUPABASE_SERVICE_ROLE_KEY` (server actions need it at
  runtime — set via `wrangler secret put`).
- Supabase MCP: if a fresh session doesn't see the `mcp__*supabase*` tools, it needs
  re-authorizing — run `/mcp` in an interactive `claude` session in this project folder.
- `gh` CLI: already authenticated in this dev environment. If not, `gh auth login` (device flow).

## What's built (Phase 1, functional)

Structure follows `CLAUDE.md` §4: `src/features/<feature>/index.ts`, no cross-feature imports.

- **`src/features/auth/`** — email/password sign-in (Supabase Auth), role-aware redirect
  (`homePathForRole` in `src/lib/roles.ts`), sign-out. `CreateAccountOptions.tsx` is a
  non-functional foundation (two paths: clinical team / client, invite-only messaging, no request
  is actually sent anywhere yet).
- **`src/features/console/`** — the consultant/clinician surface:
  - `Sidebar.tsx` — collapsible left nav, fixed to viewport (holder div reserves layout width,
    rail itself is `position: fixed` so it always spans full height and slides with the page).
  - `ConsoleView.tsx` / `MetricTable.tsx` — weekly review render: status strip, composite +
    pillar scores, per-metric rows (clickable → drill-down modal), actions/flags panel.
  - `AddDataPanel.tsx` / `entry-actions.ts` — **three forms**: record a reading (with date/time
    picker, back-dateable, and a "this corrects the most recent entry" checkbox for faulty
    inputs), add an action/safety flag (flags forced non-client-visible server-side), adjust a
    per-client goal. All writes are service-role + audited (`audit_log`).
  - `scoring.ts` — **pure functions**, the scoring engine: metric score = 60% on-target (status
    band) + 40% consistency (share of last 12 readings in target); pillar = mean of its metrics;
    composite = mean of pillars; review status = worst metric status. Recomputed on every reading,
    correction, and goal change (`recomputeReviewScores` in `entry-actions.ts`).
  - `ReportsPanel.tsx` — PDF picker UI only, explicitly non-functional (no upload, no storage,
    nothing leaves the browser) — sits above Sign-off, foundation for a later phase.
  - `data.ts` — server-side reads (`getRoster`, `getLatestReview`, `getMetricOptions`), applies
    per-client goal overrides (`client_metric_targets`) as the "effective target" everywhere.
- **`src/features/client-home/`** — the client's "calm hero" home: composite ring, pillar cards,
  "This week's focus" (client-visible actions only), "Your numbers" (client-labelled metrics only,
  each clickable → drill-down). Data comes exclusively from the SECURITY DEFINER function
  `client_home_payload()` — clients have **no direct SELECT** on `weekly_reviews` /
  `pillar_scores` / `metric_readings` / `actions_flags`.
- **`src/features/account/`** — `/console/account` (name, discipline/registration, password) and
  `/app/account` (name, password). `CommunityView.tsx` + `/app/community` page: the client's care
  team presented warmly ("The community", not "care team"), with sharing controls
  ("Following your progress" / "Pause sharing" — real consent, see RLS below).
- **`src/components/ui/`** — `StatusPill` (colour+dot+text, never colour alone),
  `Sparkline` (compact trend), `MetricDetailChart` / `MetricDetailModal` (the drill-down: 12-week
  history against a shaded target-zone band, latest value called out, "Why we track this" copy).
  Labels were overlapping in an earlier pass — fixed (band label bottom-left, callout flips below
  point near top edge, axis labels pinned to plot edges).

## Data model additions beyond `0001_init.sql`

Migrations `0002`–`0010` (all applied to the live DB; local files in
`supabase/migrations/` are kept in sync — **always add a new migration file, never edit an
applied one**):

- `0002`, `0003` — revoke default `EXECUTE` grants Postgres/Supabase give `anon`/`PUBLIC` on new
  functions (a real hardening bug caught by the security advisor, not cosmetic).
- `0004` — RLS perf: wrap `auth.uid()` in a subselect (no security change).
- `0005` — `client_home_payload()` SECURITY DEFINER function (the client-safe projection).
- `0006` — **consent is load-bearing**: `is_on_care_team()` now requires `care_team.consent_at IS
  NOT NULL`. Withdrawing consent removes DB access immediately, verified live.
- `0007` — clients can read their own `care_team` rows + `my_care_team()` helper (names/
  disciplines without widening `profiles`/`clinicians` access).
- `0008` — `metrics_catalog.why_it_matters` (education copy, all 12 metrics seeded), client
  payload extended with `history`/`target_def`/`why_it_matters`.
- `0009` — new `physio` role (enum value + `is_clinical()`).
- `0010` — `client_metric_targets` table (per-client goal overrides, RLS: care team + the client
  themselves can read), `metric_readings.recorded_at`, activity-sessions default goal fixed from
  a placeholder of 18/week to a realistic ≥6/week (one activity a day).

Current row counts (informational, will drift): profiles 8, clients 4, care_team 9,
weekly_reviews 4, pillar_scores 6, metrics_catalog 12, metric_readings 19, labs 1,
actions_flags 6, audit_log 27, client_metric_targets 3.

## Demo accounts

All password `EngelaDemo2026!` — **shared/demo-only, rotate or delete before any real data.**

| Email | Role | Notes |
|---|---|---|
| `demo.consultant@engelahealth.com` | consultant | Dr Emily Hartley — sees all 4 patients |
| `demo.consultant2@engelahealth.com` | consultant | Dr Priya Sharma — Michael Mercer + Leo Yates |
| `demo.cep@engelahealth.com` | cep | Daniel Ross — Michael Mercer only (least-disclosure demo) |
| `demo.physio@engelahealth.com` | physio | Tom Whitfield — Michael Mercer + Peter Curtis |
| `demo.client@engelahealth.com` | client | Michael Mercer, HCA-MM-0142 — rich worked example, week 32 |
| `demo.patient2@engelahealth.com` | client | Beatrice Cole, HCA-BC-0087 |
| `demo.patient3@engelahealth.com` | client | Peter Curtis, HCA-PC-0203 |
| `demo.patient4@engelahealth.com` | client | Leo Yates, HCA-LY-0011 |

Michael Mercer is the only patient with a full 12-metric weekly review, history, actions, and a
safety flag (sleep). The other three have thin/no data — good for demoing data entry live.

## Verified working (tested against the real DB/UI this session, not assumed)

- All role logins; CEP/physio roster correctly scoped to their own care team.
- RLS as client: direct REST reads of `weekly_reviews`, `labs`, another client's `clients` row all
  return `[]`; own `clients` row returns.
- Consent withdrawal removes the consultant's DB-level access to that client instantly; re-grant
  restores it.
- Clinician records a reading → appears in the client's app moments later, softened status.
- Faulty entry (grip strength "99") corrected via the correction checkbox → verified the bad value
  is gone from `history`, not just hidden.
- Goal change (VO2 max → "at or above 50") reassessed the latest reading and visibly moved the
  pillar/composite scores.
- Sidebar covers full viewport even scrolled to page bottom (the fix for the reported blank strip).
- `engelahealth.com/signin` returns 200 live.

## Open items (real, not hypothetical)

1. **`www.engelahealth.com` resolves nowhere.** The old Namecheap parking CNAME was deleted and
   nothing replaced it. Decide: redirect to apex, or serve the app directly — then wire it up
   (Cloudflare bulk redirect / a second Workers custom domain).
2. **Region**: Supabase project is `eu-west-1` (Ireland). `CLAUDE.md`'s decision log states EU/
   **London** specifically. Region is immutable post-creation. Still an open decision — flagged
   repeatedly, not yet resolved either way.
3. **Supabase DPA**: signed 2026-07-03 (this session, per Oliver).
4. **SPF/DKIM for Resend not set up.** Needed before Phase 2 invite emails from
   `team@engelahealth.com` go out, or they'll fail auth / land in spam.
5. **Reports panel is UI-only.** No upload, no storage, no PDF parsing. Explicitly a foundation.
6. **Create-account requests go nowhere.** The two-path form on `/create-account` doesn't send an
   actual invite — invite-only access is still enforced only by nobody having a real request
   pipeline yet.
7. **No audited sign-off yet** (Phase 2 per `CLAUDE.md` §5) — the console shows issued/signed-by
   read-only, no UI to actually sign off.
8. **No TOTP MFA** for clinical accounts (Phase 2 requirement in `CLAUDE.md` §3).
9. **Branch protection on `main`** — GitHub's classic protection API 403'd for this private repo
   (needs GitHub Pro, or try the newer free-tier rulesets API instead). Never resolved either way.
10. **`.claude/settings.local.json`** — gitignored (it was found recording literal API tokens in
    its permission allowlist history). Don't remove that gitignore entry.

## Suggested next steps (not prescriptive — ask Oliver what he wants first)

- Resolve the `www` DNS decision (quick, low-risk).
- Start using feature branches: `git checkout -b <name>`, PR into `main`, let CI gate the merge —
  the direct-to-main pattern so far was pragmatic bootstrapping, not the intended long-term flow.
- Phase 2 candidates per `CLAUDE.md` §5: audited sign-off UI, invite flow (make create-account
  real), TOTP MFA, RLS hardening pass + tests.
- If continuing the "make it feel less clinical" design direction: the Reports panel and
  create-account flow are the two remaining places that still read as functional-but-fake:
  candidates for the next round of real wiring or clearer "coming soon" framing.

## Conventions to keep following

- Migrations: new file per change, never edit an applied one, keep local `supabase/migrations/`
  in sync with what's actually applied to the live project (I apply via the Supabase MCP directly
  to the live DB, then write the matching `.sql` file locally — both need to happen).
- Every schema/infra change gets a `CHANGELOG.md` entry: what, why, migration/secret/DNS
  implication.
- No hard-coded colours/spacing — `src/styles/tokens.css` only.
- Client app never shows a raw lab value, disease marker, MRD, or a red/flag-styled warning —
  enforced in the data layer (SECURITY DEFINER projections), not just hidden in the UI.
- Status is always colour + dot + text (`StatusPill`), never colour alone.
- British English, no em/en dashes in interface copy.
