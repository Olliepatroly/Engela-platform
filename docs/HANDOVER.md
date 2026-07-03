# Handover — Phase 2, written 2026-07-03

Written for a fresh Claude Code session picking up this project with no prior context. Read
`CLAUDE.md` first in full (operating manual, non-negotiable rules) — this doc is "what's actually
true right now" on top of that. This file is a point-in-time snapshot; treat conflicts with the
live system, `CHANGELOG.md`, or `git log` as this file being stale, not the other way round.

## TL;DR

**Phase 1 is done and live.** A working clinical platform is in production at
**https://engelahealth.com**: real Supabase backend, real RLS, real auth, five roles wired end to
end (consultant, nurse — enum only, unused in demo data, cep, physio, client), clinician data
entry with a computed scoring engine, per-client goals, a client-facing "community" (consent)
surface, exercise programmes (now called "blocks" in the UI) with a MuscleWiki-style body map, and
community search + team-join requests on both surfaces. GitHub → Cloudflare Workers CI/CD is
green. `main` is currently clean and deployed; the working tree has no uncommitted changes.

**What's next is Phase 2** (per `CLAUDE.md` §5): audited sign-off UI, a real invite flow, TOTP MFA
for clinical accounts, and an RLS hardening + tests pass. None of these exist yet. See "Phase 2
scope" below for concrete starting points.

## Live system

- **Production**: https://engelahealth.com — confirmed live this session (`/signin` → 200,
  `/console/programs` unauthenticated → 307 to `/signin`, middleware gating works). Also reachable
  at the Workers subdomain `engela-platform.<account>.workers.dev`.
- **`www.engelahealth.com` still resolves nowhere** — unresolved since Phase 1, see Open items.
- **GitHub repo**: `Olliepatroly/Engela-platform` (private), default branch `main`. `gh` CLI is
  authenticated as `Olliepatroly` in this environment.
- **Supabase project**: "Engela-platform", ref `hsxhylmheonlcmsjlffy`, region `eu-west-1`
  (Ireland — still not London, see Open items), connected via the Supabase MCP server (project
  ID `730d2737-c96c-4bd9-bd2b-016dc6c6f90a` in this session's tool list). If a fresh session
  doesn't see the Supabase tools, they need re-authorizing via `/mcp`.
- **Cloudflare**: Worker `engela-platform` (production) + `engela-platform-preview` (PR
  previews), zone `engelahealth.com` active, custom domain attached. Deploys run from GitHub
  Actions (`.github/workflows/`), **never** from Workers Builds directly (see `wrangler.jsonc`
  comment).
- **Branch hygiene**: `feat/programs-and-community-search` was merged via PR #1 (squash-free merge
  commit) and is safe to delete on origin now. `backup/main-pre-programs` exists on origin,
  pinned to `b1fe911` (the commit immediately before the programmes/search feature landed) — kept
  deliberately as a rollback point; do not delete without asking Oliver.

## Credentials / how to get back in

- Local secrets: `.env.local` (gitignored) has `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` populated and working.
  `SUPABASE_JWT_SECRET` and `RESEND_API_KEY` are present as keys but **empty** — needed before
  Phase 2 invite emails work (see Open items #4).
- GitHub Actions secrets (already set): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. No `RESEND_*`
  secret exists yet in CI — add one when the invite flow goes in.
- `gh` CLI: already authenticated in this dev environment.

## What's built (functional, verified against the live system)

Structure follows `CLAUDE.md` §4: `src/features/<feature>/index.ts`, no cross-feature imports.

### Auth (`src/features/auth/`)
Email/password sign-in (Supabase Auth), role-aware redirect (`homePathForRole` in
`src/lib/roles.ts`), sign-out. `CreateAccountOptions.tsx` (`/create-account`) is **still a
non-functional foundation**: two paths (clinical team / client), invite-only messaging, but no
request is actually sent anywhere. This is Phase 2 work.

### Console — the clinical team's surface (`src/features/console/`, `src/features/programs/`,
`src/features/search/`)
- `Sidebar.tsx` — permanent left nav (Weekly review, Programmes, Find people, My account),
  collapsible to an icon rail on desktop. **Responsive below 56rem**: becomes a horizontal top bar
  (wordmark left, sign-out right, nav pills wrapping, roster as a scrollable strip) — the desktop
  collapse preference is ignored below that breakpoint via a `matchMedia` check in
  `Sidebar.tsx`, so a collapsed desktop rail never renders as icon-only chips on a phone.
- `ConsoleView.tsx` / `MetricTable.tsx` — the weekly review: status strip (diagnosis, treatment
  phase, MRD, QOL, sessions attended — **consultant/clinical-only**, never sent to the client),
  composite + pillar scores, per-metric rows (clickable → drill-down modal), actions/flags panel.
- `AddDataPanel.tsx` / `entry-actions.ts` — record a reading (back-dateable, correctable), add an
  action/safety flag (flags forced non-client-visible server-side), adjust a per-client goal. All
  writes are service-role + audited.
- `scoring.ts` — pure functions: metric score = 60% on-target + 40% consistency; pillar = mean of
  metrics; composite = mean of pillars; review status = worst metric status. Recomputed on every
  reading, correction, and goal change.
- `ReportsPanel.tsx` — PDF picker UI only, **still explicitly non-functional** (no upload, no
  storage). Untouched since Phase 1.
- **Exercise programmes, now four pages** under `/console/programs*` (tab nav under the patient
  banner, shared header via `ProgramTabs.tsx`):
  - **Exercise overview** (`/console/programs`) — strength/cardiovascular/mobility trend cards
    (total weight moved, active minutes per completed session, sparkline, % change since the
    start) plus an adherence card.
  - **Blocks** (`/console/programs/blocks`) — a month calendar (`buildCalendar` in
    `constants.ts`, pure function) with session status dots and the active block's date span
    tinted; block list below with an inline edit form (`updateProgram` action — audited, CEP/admin
    only, activating one block archives the others).
  - **Sessions** (`/console/programs/sessions`) — upcoming/completed lists and the full session
    breakdown (exercises, prescription, muscles worked via `BodyMap`). **CEPs and physios can mark
    session parts done for the client** (for sessions taken together) via `setCategoryDone`, which
    now accepts `client | cep | physio | admin` and audits which role acted.
  - **Planning** (`/console/programs/planning`) — start a block, add sessions, add exercises to
    any upcoming session, grow the shared exercise library. CEP/admin only; other roles see a
    read-only note.
  - Terminology: the console UI says **"block"**, not "programme" — the database tables
    (`programs`, `program_sessions`) are unchanged, only user-facing copy shifted.
- **Community search + team requests** (`/console/search`) — directory search over
  `search_directory()` (name/role/discipline only — never MRN or diagnosis), invite a client into
  your care or a fellow member to a client's team, answer/withdraw requests. See consent rule
  below.
- `src/components/ui/EngelaMark.tsx` — the brand icon (from `engela_health_icon.svg`), inlined SVG
  using `currentColor` so it drops into the sidebar, the client header and the sign-in card
  without separate assets.

### Client app — phone-first (`src/features/client-home/`, `src/features/programs/`,
`src/features/account/`, `src/features/search/`)
- `ClientHomeView.tsx` (`/app`) — composite ring, pillar cards, "This week's focus", "Your
  numbers", all sourced exclusively from the SECURITY DEFINER `client_home_payload()` — clients
  have **no direct SELECT** on `weekly_reviews` / `pillar_scores` / `metric_readings` /
  `actions_flags`. Header was recently fixed: logo + sign-out on one row, nav pills
  (Programme/Community/Account) wrap onto their own row below so nothing clips on narrow phones.
- `/app/program` and `/app/program/[sessionId]` — "Your programme": next up / coming up / done,
  and a session page where the client marks cardiovascular, resistance and mobility **done
  separately** (each a tap, reopening is one tap too, no guilt copy). Shows the same `BodyMap`.
- `/app/community` — the client's team ("The community"), consent controls
  (`CommunityView.tsx`/`setConsent`), plus **Find a specialist** search
  (`ClientSearchView.tsx`) to request community members join the client's team, and to answer
  incoming invites.
- `src/features/account/` — `/console/account` and `/app/account` for personal settings.

### Body map (`src/components/ui/BodyMap.tsx`)
Redrawn this session as anatomical line art (MuscleWiki-style): bezier-authored front/back
figures on a 300×640 canvas, every muscle compartment individually outlined, highlighted groups
filled amber (worked directly) / slate (also involved), legend always names the groups in text
(colour is never the only signal). The female figure is derived from the same authored path data
via a piecewise horizontal-scale transform (`FEMALE_STOPS` in `BodyMap.tsx`) — narrower
shoulders/waist, wider hips — not a separate drawing. `clients.body_map` (`'male' | 'female'`)
picks which figure renders; both surfaces get it automatically.

### Search / team requests — consent rule (load-bearing, read before touching)
`team_requests` has three kinds: `client_request` (client asks a member), `clinician_invite`
(member invites a client into their care), `peer_invite` (member invites a fellow member to a
client's team). **Only the client's own action sets `consent_at`**: their own request, or their
acceptance of an invite. A `peer_invite` acceptance writes the `care_team` row with `consent_at =
null` — the new clinician has **no DB access** until the client turns sharing on in The
community. This was verified live this session (Dr Priya Sharma invited Daniel Ross to Leo
Yates's team; Daniel accepted; Leo did not appear in Daniel's roster). That demo state is still
live in the database — it's real, not a bug, and fine to leave as a working example of the
consent gate, or reset if it's in the way.

## Data model (migrations `0001`–`0013`, all applied live and mirrored in `supabase/migrations/`)

- `0001` — initial schema, RLS deny-by-default, role/care-team helper functions.
- `0002`, `0003` — revoke default `EXECUTE` grants `anon`/`PUBLIC` get on new functions.
- `0004` — RLS perf (wrap `auth.uid()` in a subselect).
- `0005` — `client_home_payload()` SECURITY DEFINER client-safe projection.
- `0006` — consent gate: `is_on_care_team()` requires `care_team.consent_at IS NOT NULL`.
- `0007` — clients read their own `care_team` rows + `my_care_team()`.
- `0008` — `metrics_catalog.why_it_matters` education copy.
- `0009` — `physio` role added.
- `0010` — `client_metric_targets` (per-client goals), `metric_readings.recorded_at`.
- `0011` — **programmes/exercises/team-requests schema**: `exercise_category`, `muscle_group`,
  `session_status`, `team_request_kind`, `team_request_status` enums; `exercises`, `programs`,
  `program_sessions`, `session_exercises`, `team_requests` tables, all RLS deny-by-default
  (care team with consent, or the client themselves); `clients.body_map`; `search_directory()`
  SECURITY DEFINER (directory-safe fields only).
- `0012` — 31-exercise starter library seed (cardiovascular/resistance/mobility, muscle-tagged).
- `0013` — `my_team_requests()` SECURITY DEFINER projection with names for everyone involved.

Also `supabase/seed_demo_programs.sql` — Michael Mercer's demo block ("Rebuild strength, block
3", 17 sessions, one deliberately missed) and Beatrice Cole set to the female body figure.

**Current row counts** (informational, will drift): profiles 8, clients 4, care_team 12,
weekly_reviews 4, pillar_scores 6, metrics_catalog 12, metric_readings 19, labs 1, actions_flags 6,
audit_log 44, client_metric_targets 3, exercises 31, programs 1, program_sessions 18,
session_exercises 100, team_requests 3.

**Security advisor state** (checked this session, `get_advisors` type `security`): six
`SECURITY DEFINER` warnings, all intentional and all already locked down (`client_home_payload`,
`current_client_id`, `is_on_care_team`, `my_care_team`, `my_team_requests`, `search_directory` —
each has `revoke ... from public/anon`, `grant ... to authenticated` only). One real, actionable
item: **`auth_leaked_password_protection` is disabled** — a one-click enable in the Supabase
Auth dashboard (HaveIBeenPwned check), not a schema change. Cheap win, do it whenever.

## Demo accounts

All password `EngelaDemo2026!` — shared/demo-only, rotate or delete before any real data.

| Email | Role | Notes |
|---|---|---|
| `demo.consultant@engelahealth.com` | consultant | Dr Emily Hartley — sees all 4 patients |
| `demo.consultant2@engelahealth.com` | consultant | Dr Priya Sharma — Michael Mercer + Leo Yates |
| `demo.cep@engelahealth.com` | cep | Daniel Ross — Michael Mercer + (now) Leo Yates, sharing paused |
| `demo.physio@engelahealth.com` | physio | Tom Whitfield — Michael Mercer + Peter Curtis |
| `demo.client@engelahealth.com` | client | Michael Mercer, HCA-MM-0142 — rich worked example, week 32, has the demo block |
| `demo.patient2@engelahealth.com` | client | Beatrice Cole, HCA-BC-0087 — female body figure |
| `demo.patient3@engelahealth.com` | client | Peter Curtis, HCA-PC-0203 |
| `demo.patient4@engelahealth.com` | client | Leo Yates, HCA-LY-0011 |

## Open items (real, not hypothetical — carried over + new)

1. **`www.engelahealth.com` still resolves nowhere.** Unresolved since Phase 1. Decide: redirect
   to apex, or serve directly, then wire it up (Cloudflare bulk redirect / second custom domain).
2. **Region still `eu-west-1` (Ireland)**, not the London the decision log states. Immutable
   post-creation. Still unresolved, revisit before real patient data.
3. **`SUPABASE_JWT_SECRET` and `RESEND_API_KEY` are empty in `.env.local`.** Needed for TOTP/MFA
   work and invite emails respectively — both Phase 2 blockers, see below.
4. **SPF/DKIM for Resend not set up** on the `engelahealth.com` zone. Needed before invite emails
   from `team@engelahealth.com` will pass auth / avoid spam.
5. **Reports panel is still UI-only.** No upload, no storage, no PDF parsing.
6. **Create-account requests still go nowhere.** `/create-account`'s two-path form doesn't send an
   invite. This is exactly what the Phase 2 invite flow needs to replace.
7. **No audited sign-off yet.** The console shows issued/signed-by read-only; no UI to sign off.
8. **No TOTP MFA** for clinical accounts.
9. **Branch protection on `main` still unresolved.** GitHub's classic protection API 403'd for
   this private repo before (needs GitHub Pro, or try the rulesets API). Never resolved.
10. **`.claude/settings.local.json`** is gitignored (previously found recording literal API tokens
    in its permission history) — do not remove that gitignore entry.
11. **`feat/programs-and-community-search` branch still exists on origin**, fully merged — safe to
    delete when convenient. `backup/main-pre-programs` should stay as the pre-feature rollback
    point.
12. **`auth_leaked_password_protection` disabled** — see Security advisor state above, cheap win.

## Phase 2 scope (per `CLAUDE.md` §5) — concrete starting points

**Gate for this phase: sign-off persists and writes an audit entry.**

1. **Audited sign-off UI.** `weekly_reviews` already has `issued_at`/`issued_by`/`signed_at`/
   `signed_by` columns (see `0001_init.sql`) and `ConsoleView.tsx` already renders them read-only
   (search for "Sign-off" in that file). What's missing: a server action (follow the
   `entry-actions.ts` pattern — verify clinical role + RLS access, write with the service role,
   append to `audit_log`) that sets `signed_by`/`signed_at`, plus a button/form in
   `ConsoleView.tsx`. A read-only **audit-trail screen** for the clinical team is also in scope —
   `audit_log` already has full RLS (`audit_log_select_clinical`) and rows going back to Phase 1;
   it just needs a page (`/console/audit`?) to read and render them.
2. **Invite flow** (make `/create-account` real). Needs: `RESEND_API_KEY` populated, SPF/DKIM on
   the zone (Open item #4), a signed invite-token table or reuse Supabase's own invite mechanism,
   and wiring `CreateAccountOptions.tsx`'s two paths to actually send something. `/invite/[token]`
   already exists as a route stub — check what's there before building parallel infrastructure.
3. **TOTP MFA for clinical accounts.** Supabase Auth supports TOTP natively
   (`supabase.auth.mfa.*`); needs `SUPABASE_JWT_SECRET` populated (Open item #3), a enrolment UI
   (likely under `/console/account`), and a middleware check that clinical roles have MFA verified
   before reaching `/console/*`. Confirm with Oliver whether this blocks existing demo accounts
   from signing in — probably needs a grace path or the demo accounts get enrolled too.
4. **RLS hardening + tests.** No test files exist yet (`pnpm test` reports "No test files found"
   — `vitest` is configured, just unused). `scoring.ts` and the new `constants.ts` calendar
   functions (`buildCalendar`, `calendarRange`) are pure and are the easiest first tests. For RLS,
   the project's existing pattern is manual verification via direct REST calls (see "Verified
   working" sections in this doc and prior ones) — a real test pass would mean scripting those
   checks (e.g. a client fetching another client's `clients` row returns `[]`) rather than
   re-verifying by hand every session.

## Verified working this session (real DB/UI, not assumed)

- All role logins still work; roster scoping by care team still correct.
- CEP dashboard, blocks calendar, sessions breakdown and body map all render with live data for
  Michael Mercer (strength trend 2,040 kg, up 13% since the start).
- Client marked a session part done on `/app/program/[sessionId]`; audited as
  `session_part.completed`.
- Peer-invite consent gate: Priya invited Daniel to Leo's team, Daniel accepted, `care_team` row
  landed with `consent_at = null`, Leo did not appear in Daniel's roster on reload.
- Console sidebar responsive breakpoint: horizontal top bar below 56rem on `/console`,
  `/console/programs`, `/console/search`; desktop collapse toggle still works and doesn't leak
  into the mobile layout.
- Client app header: logo + sign-out always visible on a 375px viewport; nav pills wrap.
- `EngelaMark` renders correctly on the sign-in card, client header, and both sidebar states
  (expanded wordmark, collapsed icon rail).
- Production: `/signin` → 200, `/console/programs` unauthenticated → 307 to `/signin`.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` all green as of the last commit on `main`
  (`b36a219`). `pnpm test` passes trivially (no test files yet — see Phase 2 item 4).

## Conventions to keep following

- Migrations: new file per change, never edit an applied one, keep local `supabase/migrations/`
  in sync with what's actually applied to the live project (apply via the Supabase MCP directly
  to the live DB, then write the matching `.sql` file locally — both need to happen).
- Every schema/infra change gets a `CHANGELOG.md` entry: what, why, migration/secret/DNS
  implication.
- No hard-coded colours/spacing — `src/styles/tokens.css` only.
- Client app never shows a raw lab value, disease marker, MRD, or a red/flag-styled warning —
  enforced in the data layer (SECURITY DEFINER projections), not just hidden in the UI.
- Status is always colour + dot + text (`StatusPill`), never colour alone.
- British English, no em/en dashes in interface copy.
- Console UI says "block", not "programme"; keep this consistent in any new programme-area copy.
- Team-request writes always go through the consent rule above — never set `care_team.consent_at`
  except from the client's own request or acceptance.
- Use feature branches + PRs going forward (established this session with PR #1) — the
  direct-to-main commits before that were pragmatic bootstrapping, not the intended long-term
  flow. (One direct-to-main exception this session: a small navbar/logo fix, explicitly requested
  pushed directly by Oliver — not a pattern to repeat by default.)
