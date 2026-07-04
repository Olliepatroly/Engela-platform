# Handover — Phase 3, written 2026-07-04

Written for a fresh Claude Code session picking up this project with no prior context. Read
`CLAUDE.md` first in full (operating manual, non-negotiable rules) — this doc is "what's actually
true right now" on top of that. This file is a point-in-time snapshot; treat conflicts with the
live system, `CHANGELOG.md`, or `git log` as this file being stale, not the other way round.

## TL;DR

**Phase 1 and Phase 2 are code-complete.** Phase 1 is live in production. **Phase 2 is built and
verified but not yet merged to `main`** — it lives on branch `feat/phase-2-clinical-core` as
**PR #2**, CI green (typecheck, lint, 28 tests, build, preview deploy all pass). Phase 2 added:
audited weekly-review sign-off, a read-only audit trail with care-team scoping + search/filters +
PDF export, a live invite flow (signed single-use links, `/console/invites`, `/invite/[token]`,
real create-account requests), TOTP two-step verification for clinical accounts, and a test pass
(unit tests for the scoring engine and calendar, plus a scripted live RLS suite).

**Read this carefully — the database is ahead of the deployed app.** Migrations `0014` and `0015`
were applied to the **live Supabase project** during Phase 2 (via the Supabase MCP), so the live
DB already has the invites/account_requests tables and the tightened audit-log RLS. But the
**production Worker still runs Phase 1 code** (last deployed `main`), because Phase 2 is on PR #2
and `Deploy Production` only runs on `main`. Production won't show any Phase 2 feature until PR #2
is reviewed and merged. The additive schema is harmless to the old app (it doesn't read the new
tables). **First job for whoever picks this up: decide with Oliver whether to merge PR #2** (a
second reviewer on data-access changes is recommended, `CLAUDE.md` §7 #6), then let it deploy.

**What's next is Phase 3** (per `CLAUDE.md` §5, "Client depth"): pillar detail, progress, tickable
actions, "message Ollie", and the empty/paused/no-baseline/not-measured states + skeletons. Oliver
has also asked for two specific client-app design changes as part of this phase — a **bottom
navigation bar** and **expandable/collapsible pillars** — both fully specced in "Phase 3 scope"
below.

## Live system

- **Production**: https://engelahealth.com (Phase 1 code; Phase 2 pending PR #2 merge). Also
  reachable at the Workers subdomain `engela-platform.<account>.workers.dev`.
- **`www.engelahealth.com` still resolves nowhere** — unresolved since Phase 1, see Open items.
- **GitHub repo**: `Olliepatroly/Engela-platform` (private), default branch `main`. `gh` CLI is
  authenticated as `Olliepatroly`. **Phase 2 = PR #2** on `feat/phase-2-clinical-core` (open, CI
  green). PR #1 (programmes/search) already merged.
- **Supabase project**: "Engela-platform", ref `hsxhylmheonlcmsjlffy`, region `eu-west-1`
  (Ireland — still not London, see Open items), connected via the Supabase MCP server (project
  ID `730d2737-c96c-4bd9-bd2b-016dc6c6f90a`). **Live schema is at migration `0015`.** If a fresh
  session doesn't see the Supabase tools, they need re-authorizing via `/mcp`.
- **Cloudflare**: Worker `engela-platform` (production) + `engela-platform-preview` (PR previews),
  zone `engelahealth.com` active, custom domain attached. Deploys run from GitHub Actions
  (`.github/workflows/`), **never** from Workers Builds directly.
- **Branch hygiene**: `feat/programs-and-community-search` (PR #1, merged) is safe to delete on
  origin. `backup/main-pre-programs` (pinned to `b1fe911`) stays as a rollback point — do not
  delete without asking Oliver.

## Credentials / how to get back in

- Local secrets: `.env.local` (gitignored) has `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` working. **`DEMO_PASSWORD`** was
  added (the shared demo-account password) — used only by the RLS test suite.
  `SUPABASE_JWT_SECRET` is still empty and turned out **not** to be needed for MFA (assurance
  levels are read through the Supabase client, not by verifying JWTs by hand). `RESEND_API_KEY` is
  still **empty** — invite emails stay off until it is set (link-sharing fallback works meanwhile).
- GitHub Actions secrets (set): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Add a `RESEND_API_KEY`
  secret when invite emails go live.
- `gh` CLI: authenticated in this dev environment.

## What's built

Structure follows `CLAUDE.md` §4: `src/features/<feature>/index.ts`, no cross-feature imports
except via `components/ui`, `lib/`, `types/`.

### Phase 1 (live in production)

- **Auth** (`src/features/auth/`): email/password sign-in, role-aware redirect
  (`homePathForRole` in `src/lib/roles.ts`), sign-out.
- **Console** — the clinical team's surface: `Sidebar.tsx` (permanent left nav, collapsible,
  responsive top bar below 56rem), the weekly review (`ConsoleView.tsx`/`MetricTable.tsx`: status
  strip, composite + pillar scores, per-metric drill-down modal, actions/flags), clinician data
  entry (`AddDataPanel.tsx`/`entry-actions.ts`: readings, actions/flags, per-client goals — all
  service-role + audited), the scoring engine (`scoring.ts`: metric = 60% on-target + 40%
  consistency; pillar = mean; composite = mean; status = worst metric).
- **Programmes** ("blocks" in the UI) across four pages under `/console/programs*`: overview,
  blocks calendar, sessions breakdown with the MuscleWiki-style `BodyMap`, and planning.
- **Community search + team requests** (`/console/search`, `/app/community`) with the load-bearing
  **consent rule**: only the client's own action sets `care_team.consent_at`; a peer-invite
  acceptance writes the row with `consent_at = null` (no DB access until the client turns sharing
  on). See `CLAUDE.md` and prior handovers before touching this.
- **Client app** — phone-first (`src/features/client-home/`, `programs/`, `account/`, `search/`):
  `/app` home (composite ring, pillar cards, focus, "your numbers", all from the SECURITY DEFINER
  `client_home_payload()`), `/app/program`, `/app/community`, `/app/account`.

### Phase 2 (on PR #2, verified live during the session — see below)

- **Audited sign-off** (`src/features/console/SignOffPanel.tsx`, `signOffReview` in
  `entry-actions.ts`): the consultant/admin signs off the selected weekly review from a
  confirm-and-sign form; writes `signed_by`/`signed_at` and appends `weekly_review.signed_off` to
  `audit_log`. No double-sign, no un-sign. Other clinical roles see the record read-only. **This
  is the Phase 2 gate** — verified live (Beatrice Cole week 14 signed by Dr Emily Hartley, audit
  row written).
- **Audit trail** (`/console/audit`, `AuditTrailView.tsx`, `getAuditTrail`/`audit-actions.ts`):
  the append-only trail, newest first, with humanised action labels. **Care-team scoped** — see
  migration `0015`: a non-admin reads only their own actions plus rows about clients on their care
  team *with consent granted*; admins see everything; rows with no client (MFA, profile, invites,
  library edits) are actor/admin-only. **Search + filters** (free text, Who, Client, date range;
  dropdowns built only from rows the viewer can see) and **PDF export** of the current selection
  (standalone print window → Save as PDF, tokens read at runtime, confidential header). Exporting
  writes an `audit.exported` governance event. Verified live: Tom Whitfield's trail correctly
  showed only his two consented clients, not the whole database.
- **Invite flow** (`src/features/invites/`, migration `0014`): `invites` (single-use links,
  7-day expiry, only the SHA-256 token hash stored) + `account_requests`, both RLS deny-by-default.
  `/console/invites` sends/tracks/revokes invitations (consultant/admin invite any role, others
  invite clients only) and follows up create-account requests. `/invite/[token]` creates the
  account with the invited role (the only way a role is assigned); a client's acceptance grants
  consent for the inviter's care-team membership. `/create-account` files real requests. Email via
  Resend (`src/lib/email.ts`) when `RESEND_API_KEY` is set, else the console shows the link to
  share. Verified live end to end with a throwaway acceptance, then fully cleaned up.
- **TOTP two-step verification** (`src/features/account/MfaSettings.tsx`, `MfaChallengeForm.tsx`,
  `verifyMfaCode`): enrolment card on `/console/account`, a code step at sign-in, and a middleware
  gate holding assurance-level-1 sessions on `/signin/mfa`. Enrol/unenrol audited. **Grace path**:
  accounts without a factor sign in as before (demo accounts unaffected). Verified live by
  enrolling the demo physio with real codes, confirming the step-up, then unenrolling.
- **Tests**: `src/features/console/scoring.test.ts`, `src/features/programs/constants.test.ts`
  (21 unit tests), and `tests/rls.test.ts` (a live RLS suite: own-record scoping, empty clinical
  tables for clients, no disease markers in the projection, cross-client isolation, the consent
  gate, audit care-team scoping, write refusal, anonymous access). The RLS suite runs against the
  live project when `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`/`DEMO_PASSWORD` are present and skips
  cleanly otherwise, so CI stays green without secrets. `pnpm test` = 28 passed, 1 skipped.

## Data model (migrations 0001–0015, all applied live and mirrored in `supabase/migrations/`)

`0001`–`0013` as in the Phase 2 handover (initial schema + RLS, function grant hardening, RLS
perf, `client_home_payload`, consent gates, client care-team reads, metric education, physio role,
client goals, programmes/exercises/team-requests, exercise seed, `my_team_requests`). New this
phase:

- `0014_invites_and_account_requests.sql` — `invites` and `account_requests` tables, RLS
  deny-by-default with clinical-only SELECT and server-only writes.
- `0015_audit_log_care_team_scope.sql` — `audit_client_id(entity, entity_id, meta)` extractor +
  rewritten `audit_log_select_clinical` so audit reads are scoped to the consented care team (fixes
  a data-sensitivity exposure where any clinician could read audit `meta` about any client). Adds
  indexes on `audit_log (at desc)` and `(actor_id)`. No column/type change.

**Migration discipline:** new file per change, never edit an applied one, apply to the live project
via the Supabase MCP *and* write the matching `.sql` file locally, regenerate
`src/types/database.types.ts` after any schema change (`0015` needed no regen — no new columns).

## Demo accounts

All password `EngelaDemo2026!` — shared/demo-only, rotate or delete before any real data.

| Email | Role | Notes |
|---|---|---|
| `demo.consultant@engelahealth.com` | consultant | Dr Emily Hartley — sees all 4 patients |
| `demo.consultant2@engelahealth.com` | consultant | Dr Priya Sharma — Michael Mercer + Leo Yates |
| `demo.cep@engelahealth.com` | cep | Daniel Ross — Michael Mercer + Leo Yates (sharing paused) |
| `demo.physio@engelahealth.com` | physio | Tom Whitfield — Michael Mercer + Peter Curtis |
| `demo.client@engelahealth.com` | client | Michael Mercer, HCA-MM-0142 — rich worked example, week 32 |
| `demo.patient2@engelahealth.com` | client | Beatrice Cole, HCA-BC-0087 — female body figure |
| `demo.patient3@engelahealth.com` | client | Peter Curtis, HCA-PC-0203 |
| `demo.patient4@engelahealth.com` | client | Leo Yates, HCA-LY-0011 |

Note: Beatrice Cole's week 14 review is now **signed off** (Dr Emily Hartley) from Phase 2 sign-off
testing — a good live example. Michael Mercer's latest review is deliberately left unsigned so the
sign-off button can be demoed.

## Open items (carried over + new)

1. **Merge PR #2.** Phase 2 is not in production until this merges and deploys. Decide on a second
   reviewer for the data-access changes first (`CLAUDE.md` §7 #6).
2. **MFA is opt-in with a grace path; decide the policy.** `CLAUDE.md` §3 says clinical accounts
   *require* TOTP MFA. The build ships a grace path (no factor = sign in as before) so demo
   accounts keep working. Recommendation (unchanged after discussion): keep it **mandatory** and
   use the grace path as a rollout window (e.g. "enrol within N days of account creation") rather
   than a permanent opt-out — a signed liability waiver does not reduce the controller's UK GDPR
   exposure for special-category data. **Blocker before wider rollout: there is no recovery-code
   flow.** If a clinician enrols then loses their authenticator before disabling MFA, they are
   locked out and recovery means deleting their factor in the database. Build a recovery path
   (backup codes or an admin-reset action) before making MFA mandatory.
3. **`RESEND_API_KEY` empty + SPF/DKIM not set on the zone.** Invite emails stay off (link-sharing
   fallback works). Set the key (locally + a CI/Workers secret) and configure SPF/DKIM for
   `team@engelahealth.com` before emails send.
4. **Leaked-password protection needs the Pro plan.** The `auth_leaked_password_protection`
   advisor item = the "Prevent use of leaked passwords" toggle in Supabase Auth → Sign In /
   Providers. Confirmed via Supabase docs: **available on Pro Plan and above only.** It cannot be
   enabled on the current plan — park it until/if the project upgrades, or accept the residual risk
   and rely on the 10-char minimum + MFA.
5. **`www.engelahealth.com` resolves nowhere** (redirect to apex or serve directly, then wire it).
6. **Region is `eu-west-1` (Ireland), not London.** Immutable post-creation; revisit before real
   patient data.
7. **Reports panel is still UI-only** (`ReportsPanel.tsx`): no upload, storage, or PDF parsing.
8. **Branch protection on `main`** still unresolved (classic protection API 403'd for this private
   repo; try the rulesets API or GitHub Pro).
9. Six SECURITY DEFINER advisor warnings remain — all intentional and locked down (each revokes
   from public/anon, grants to authenticated). `audit_client_id` (new in `0015`) is SECURITY
   INVOKER, so it adds no warning.

## Phase 3 scope (per `CLAUDE.md` §5 — "Client depth")

Gate: the client app is complete. Per `CLAUDE.md`: pillar detail, progress, tickable actions,
"message Ollie", and the empty/paused/no-baseline/not-measured states + skeletons. Oliver has
prioritised two client-app design changes within this phase, specced below. **Client-app safety
rules are load-bearing (`CLAUDE.md` §2/§5): the client app never shows a raw lab value, disease
marker, MRD, or a red/"flag"-styled warning; status is always colour + dot + text; estimates carry
the "estimate, not a lab measure" caveat. Everything the client sees still comes only from
`client_home_payload()` — do not add direct table access.**

### 3a. Bottom navigation bar for the client app (design change)

**What:** move the client app's section navigation from the inline text links in the header to a
**fixed bottom tab bar** (phone-first), matching the aesthetic of Oliver's reference screenshot: a
clean bar pinned to the bottom on a cream/surface background, the **active tab in navy
(`--c-ink`) with a small amber (`--c-amber`) dot** above/beside its label, inactive tabs in muted
grey (`--c-text-tertiary`), Hanken (body) type. Keep the wordmark + Sign out in the top header;
move only the section nav to the bottom.

**Keep the current options — ignore the labels in the screenshot.** The screenshot shows
`Week / Progress / Actions / Ollie`; those are from the old design demo and are a *different*
information architecture (Progress, Actions and the "Ollie" chat are separate later features).
**Use the four current client destinations:**

- **Home** — the `/app` weekly at-a-glance view (label it "Home", or "Week" if Oliver prefers —
  the hero already says "Here is your week"; this is the one screenshot label that happens to fit,
  so confirm the wording with Oliver).
- **Programme** — `/app/program`
- **Community** — `/app/community`
- **Account** — `/app/account`

**Implementation notes:**

- The bar is shared across all four routes, so it belongs in a **new client-segment layout**
  (`src/app/app/layout.tsx` — does not exist yet) rather than in `ClientHomeView` alone. Today
  `ClientHomeView.tsx` renders its own inline `<nav className={styles.clientNav}>` (lines ~35–45);
  the program/community/account pages have their own headers. Extract a shared `<ClientTabBar>` (a
  client component using `usePathname()` for the active state) and render it from the layout;
  remove the per-page inline nav.
- Fixed position at the bottom, safe-area aware: `padding-bottom: env(safe-area-inset-bottom)`.
  Add matching bottom padding to page content so the bar never covers the last element (the home
  page's disclaimer currently sits at the very bottom).
- Accessibility: `aria-current="page"` on the active tab; the active state is dot + navy text
  (never colour alone). Tokens only — no hard-coded colours/spacing.
- Acceptance: on a 375px viewport all four tabs fit on one row without wrapping or clipping; the
  active tab is unambiguous; content is never hidden behind the bar; the top header keeps only the
  wordmark + Sign out.

### 3b. Expandable / collapsible pillars (design change)

**What:** on the client home, make each of the **three pillars an accordion**. Collapsed, a pillar
shows its name, score and trend (as the cards do now). Expanded, it reveals **that pillar's detail
metrics** — e.g. Movement → active sessions, grip strength, etc.; Nutrition → protein, etc.;
Recovery and immunity → its metrics — each with its value, trend and estimate caveat. This
replaces today's separate flat "Your numbers" section: the metrics move *into* their pillar.

**Data — no backend change needed.** `client_home_payload()` already returns `home.metrics` where
**every metric carries its `pillar`** (`ClientHomeVM.metrics[].pillar` in
`src/features/client-home/data.ts`), plus `label`, `current`, `previous`, `unit`, `is_estimate`,
`status` (already softened: `flag` arrives as `focus`), `history`, `target_def` and
`why_it_matters`. So the accordion is a **pure client-side regroup**: group `home.metrics` by
`pillar` under the matching `home.pillars` entry. No new query, no new projection, no new exposure.

**Implementation notes:**

- Client-facing pillar labels are **Movement / Nutrition / Recovery and immunity** (see
  `PILLAR_LABELS` in `ClientHomeView.tsx`) — not the console's Exercise/Immune. Keep the client
  labels.
- Each pillar header is a `<button aria-expanded aria-controls>` with a chevron; recommend allowing
  multiple open at once, default all collapsed (or auto-open the lowest-scoring pillar). Reuse the
  existing `ClientMetrics`/metric-row rendering for the expanded content so the estimate caveat and
  colour + dot + text status come along unchanged.
- Keep the composite ring and "This week's focus" as they are; the three expandable pillars sit
  where the pillar cards + "Your numbers" are today.
- Acceptance: tapping a pillar expands/collapses it smoothly on a phone; every metric appears under
  the correct pillar; estimate metrics still show the caveat; no raw lab/MRD/flag styling ever
  appears; all values still trace to `client_home_payload()`.

### 3c. The rest of Phase 3 (per `CLAUDE.md` §5)

- **Progress** and **Actions** surfaces (the bottom bar makes room for these as future tabs, but
  only Home/Programme/Community/Account ship now — see 3a).
- **Tickable actions** for the client, **"message Ollie"**, and the **empty / paused /
  no-baseline / not-measured states + skeletons** across the client app.

## Conventions to keep following

- Migrations: new file per change, never edit an applied one; apply to the live project via the
  Supabase MCP **and** write the matching `.sql` locally; regenerate `database.types.ts` after
  schema changes; re-verify RLS default-deny.
- Every schema/infra change gets a `CHANGELOG.md` entry (what, why, migration/secret/DNS
  implication). Handover docs are updated per phase (`docs/HANDOVER.md`).
- No hard-coded colours/spacing — `src/styles/tokens.css` only.
- Client app never shows a raw lab value, disease marker, MRD, or a red/flag-styled warning —
  enforced in the data layer (SECURITY DEFINER projections), not just hidden in the UI.
- Status is always colour + dot + text (`StatusPill`), never colour alone.
- British English, no em/en dashes in interface copy. Console UI says "block", not "programme".
- Team-request writes always go through the consent rule — never set `care_team.consent_at` except
  from the client's own request or acceptance.
- Feature branches + PRs; never push to `main`; CI must pass. Small, reviewable PRs.
