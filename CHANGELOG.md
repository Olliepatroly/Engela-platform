# Changelog

Newest first. Every change records: what, why, files, and any migration/secret/DNS implication.

## 2026-07-04 — Audit trail: care-team scoping, search/filters, PDF export

**What:**
- **Audit reads are now scoped to the consented care team (security fix).** Previously
  `audit_log_select_clinical` let any clinical user read every audit row, whose `meta` can
  hold special-category detail (metric codes, values) about any client. Migration
  `0015_audit_log_care_team_scope.sql` adds `audit_client_id(entity, entity_id, meta)` (pulls
  the client from `meta.client_id`, or `entity_id` for consent events; uuid-guarded, no table
  access) and rewrites the policy so a non-admin reads only their own actions plus rows about
  clients on their care team **with consent granted** (reusing `is_on_care_team`, which already
  requires `consent_at IS NOT NULL`). Admins keep the full governance view. Rows with no
  resolvable client (MFA, profile, invites, library edits) stay visible to the actor and
  admins. **Verified live:** Tom Whitfield's trail dropped from 44+ rows to 17, showing only
  Michael Mercer and Peter Curtis (his consented clients); Beatrice Cole and Leo Yates events,
  including a sign-off, are gone.
- **Search and filters on `/console/audit`:** free-text search (name, action, detail), plus
  Who, Client and date-range (From/To) filters. The Who and Client dropdowns are built from the
  rows the viewer can actually see, so you can only filter by people and clients already in your
  own audit view. Client-side over the RLS-scoped set, so nothing sensitive is filtered only in
  the browser.
- **PDF export of the current selection:** exports exactly the filtered rows to a print-ready
  report (opened in a standalone window, "Save as PDF") with a header naming who generated it,
  when, the filters applied and the record count, plus a confidentiality notice. Colours are
  read from the app's CSS tokens at runtime rather than hard-coded. Serves subject-access
  requests and governance reviews (e.g. "all interactions with Tom Whitfield in July").
- **Exporting is itself audited:** `logAuditExport` writes an `audit.exported` event with the
  filter summary and row count (no client identifiers), so pulling a report is on the record.
- **Test:** the live RLS suite gains a check that a clinician never sees an audit row about a
  client outside their consented care team.

**Why:** the audit `meta` detail for non-care-team clients was a data-sensitivity exposure
(flagged by Oliver); least-disclosure applies to the audit trail as much as the record itself.
Filtering and export make the trail usable for real governance and GDPR subject-access work.

**Migration/secret/DNS implications:**
- Migration `0015_audit_log_care_team_scope.sql` applied to the live project and mirrored
  locally. No schema/column change, so `database.types.ts` did not need regenerating. Adds
  indexes on `audit_log (at desc)` and `(actor_id)`.
- No new secrets. PDF export is client-side (browser Save-as-PDF), so nothing was added to the
  Worker bundle.

## 2026-07-04 — Phase 2 clinical core: audited sign-off, audit trail, invite flow, TOTP MFA, tests

**What:**
- **Audited sign-off (the Phase 2 gate).** The consultant (or admin) signs off the selected
  weekly review from a confirm-and-sign form in the console (`SignOffPanel.tsx`,
  `signOffReview` in `entry-actions.ts`). Signing writes `signed_by`/`signed_at` on
  `weekly_reviews` and appends `weekly_review.signed_off` to the append-only `audit_log`;
  a signed review cannot be signed twice and there is no un-sign. Other clinical roles see
  the sign-off record read-only.
- **Audit trail screen** (`/console/audit`): the whole `audit_log`, newest first, with actor
  names, humanised action labels, client resolution (a client outside the viewer's care team
  shows as exactly that, no name) and compact detail. Read-only; served by the existing
  `audit_log_select_clinical` policy.
- **Invite flow, live end to end.** Migration `0014_invites_and_account_requests.sql`:
  `invites` (single-use signed links; only the SHA-256 token hash is stored) and
  `account_requests` (from the public create-account page), both RLS deny-by-default with
  clinical-only SELECT and server-only writes. New `/console/invites` screen: send an
  invitation (consultant/admin can invite any role, other clinical roles invite clients
  only), follow up create-account requests, revoke pending invites, track status.
  `/invite/[token]` accepts: the account is created with the invited role (the only way a
  role is ever assigned), a client invite carries optional MRN/diagnosis and the client's
  acceptance itself grants consent for the inviter's care-team membership (consent rule
  respected), and the new member is signed straight in. `/create-account` now files real
  requests. Invitation email goes out via Resend (`src/lib/email.ts`) when
  `RESEND_API_KEY` is set; until then the console shows the link to share personally.
- **TOTP two-step verification for clinical accounts.** Enrolment card on
  `/console/account` (`MfaSettings.tsx`: QR + manual key, confirm with a code, turn off
  again); sign-in gains a code step when the account has a verified factor
  (`verifyMfaCode`); the middleware holds sessions still at assurance level 1 away from
  `/console`/`/app` on `/signin/mfa` until the code is presented. Enrolment and removal are
  audited (`mfa.enrolled` / `mfa.unenrolled`). Grace path: accounts without a factor sign
  in as before (demo accounts unaffected); mandatory enrolment for clinical roles is a
  follow-up decision. `SUPABASE_JWT_SECRET` turned out not to be needed: assurance levels
  are read through the Supabase client, not by verifying JWTs by hand.
- **Tests.** Vitest units for the scoring engine and the blocks calendar
  (`scoring.test.ts`, `constants.test.ts`), and a scripted RLS suite (`tests/rls.test.ts`)
  that replaces the by-hand REST checks: client sees only their own record, clinical
  tables return nothing to clients, `client_home_payload` carries no disease markers,
  cross-client isolation, the consent gate (paused sharing hides the client), write
  refusal, and anonymous gets nothing. Runs against the live project when
  `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`/`DEMO_PASSWORD` are present (`.env.local` is read
  automatically) and skips cleanly otherwise, so CI stays green without secrets.

**Why:** Phase 2 per CLAUDE.md §5: sign-off must persist and write an audit entry (verified
live: Beatrice Cole week 14 signed by Dr Emily Hartley, audit row written), onboarding must
be invite-only with no self-registered roles, clinical accounts need MFA, and the RLS
boundary needed a repeatable test pass.

**Migration/secret/DNS implications:**
- Migration `0014_invites_and_account_requests.sql` applied to the live project and
  mirrored locally; `database.types.ts` regenerated.
- `RESEND_API_KEY` still empty (Open item): invite emails stay off, link-sharing fallback
  active. SPF/DKIM on the zone still needed before emails go out. Add a `RESEND_API_KEY`
  secret to CI/Workers when ready — no code change needed.
- `DEMO_PASSWORD` added to `.env.local` (gitignored) for the RLS suite.
- Verified with a throwaway invite acceptance against the live DB; all test rows (user,
  client, care team, invite, request, audit entries) were removed afterwards.

## 2026-07-03 — Programmes split into four pages, calendar blocks, redrawn body figures

**What:**
- **The console programmes area is now four focused pages** (tab nav under the patient banner)
  instead of one busy screen:
  - **Exercise overview** (`/console/programs`): strength, cardiovascular and mobility trends
    across completed sessions (total weight moved and active minutes per session, sparkline,
    change since the start), plus an adherence card (completed, missed, % done, coming up).
    Sessions with no weighted or timed work in a category do not drag that trend to zero.
  - **Blocks** (`/console/programs/blocks`): a month calendar (Monday weeks, prev/next
    navigation) of every session with status dots, today ringed and the active block's span
    tinted; below it, every block with an edit form (title, focus, start date, status) for the
    CEP via a new audited `updateProgram` action. Setting a block active archives the others.
  - **Sessions** (`/console/programs/sessions`): the upcoming/completed lists and the full
    breakdown as before, and **CEPs and physios can now mark session parts done for the
    client** (for sessions they take together); the audit trail records who, and consultants
    stay read-only.
  - **Planning** (`/console/programs/planning`): start a block, add sessions, put exercises
    into any upcoming session (new session picker), grow the library. CEP/admin only.
- UI language shifted from "programme" to **"block"** on the console (DB tables unchanged).
- **Body figures redrawn as anatomical line art**: bezier-authored front/back figures
  (300 x 640) with every muscle compartment outlined (MuscleWiki style), highlighted groups
  filled amber (worked directly) or slate (also involved), and the female variant derived
  from a piecewise proportional transform. Both surfaces get the new figures automatically.

**Verified live:** all four tabs render for the CEP with real data (strength 2040 kg, up 13%);
calendar shows July 2026 with the block span highlighted and a builder-added session picked up;
planning forms present with the session picker; the client session page renders the new figures
on mobile and category completion still works both ways.

**Migration implication:** none (no schema change). Front-end and server actions only.

## 2026-07-03 — Exercise programmes, body map, community search + team requests

**What:**
- **Exercise programmes** (`src/features/programs/`, `/console/programs`, `/app/program`):
  a shared exercise library (28 seeded exercises across cardiovascular, resistance and mobility,
  each tagged with primary/secondary muscle groups), per-client programmes made of dated sessions,
  and prescriptions (sets, reps, weight, minutes, distance, notes). The whole care team views a
  client's programme; **building is the CEP's capability** (and admin): add exercises to the
  library, start a programme (archives the previous one), add sessions, add exercises to a
  session. The console shows an upcoming/history dashboard; clicking a session opens the full
  breakdown (per-category exercises, prescription, muscles worked).
- **Body map** (`src/components/ui/BodyMap.tsx`): MuscleWiki-style front + back SVG figures,
  male or female per client (`clients.body_map`, Beatrice Cole seeded female), muscles worked
  highlighted (amber = worked directly, slate = also involved) with a text legend, so colour is
  never the only signal.
- **Client programme surface**: "Your programme" (next up, coming up, what you have done) and a
  session page where the client marks **each part done separately** (cardiovascular, resistance,
  mobility); the session completes when every part is done, reopening is one tap and guilt-free.
  A skipped session reads as neutral ("Skipped, rest protects progress too") — no red on the
  client app, ever.
- **Community search + team requests** (`src/features/search/`, `/console/search`, search on
  `/app/community`): name search over directory-safe fields only (name, role, discipline; no MRN,
  no diagnosis). Clients ask members to join their community; members invite clients into their
  care or invite fellow members to a client's team. Accept/decline/withdraw flows with a full
  audit trail. **Consent stays the client's alone**: a client's own request or acceptance grants
  consent; a member-to-member acceptance joins with sharing paused (`consent_at` null) until the
  client turns it on in The community.
- Demo seed: Michael Mercer gets "Rebuild strength, block 3" (17 sessions, 8 June to 15 July
  2026, one deliberately missed) built by Daniel Ross (`supabase/seed_demo_programs.sql`).

**Verified live (real DB, both surfaces):** CEP sees the dashboard and session breakdown with the
body map; client marked mobility done on today's session (audited `session_part.completed`);
client search shows "In your community" for existing team; Dr Priya Sharma invited Daniel Ross to
Leo Yates's team, Daniel accepted, and the care_team row landed with `consent_at` null — Leo does
not appear in Daniel's roster until Leo enables sharing. Typecheck, lint and build green; Supabase
security advisor shows no new findings beyond the intentional SECURITY DEFINER RPC warnings.

**Migration implication:** migrations `0011` (enums, `exercises`, `programs`, `program_sessions`,
`session_exercises`, `team_requests`, `clients.body_map`, RLS deny-by-default,
`search_directory()`), `0012` (exercise library seed) and `0013` (`my_team_requests()`) applied
to the live project and mirrored in `supabase/migrations/`. `database.types.ts` regenerated.
No secret or DNS changes.

## 2026-07-03 — Domain live, DPA signed

**What:** Oliver removed the two Namecheap parking DNS records (A @ apex, CNAME `www`) from the
`engelahealth.com` zone; MX/SPF/DMARC (email forwarding) were left untouched. With the hostname
free of externally-managed records, the Cloudflare Workers custom domain attach that previously
failed now succeeds: `engelahealth.com` is attached to the `engela-platform` Worker
(`environment: production`), certificate provisioned, confirmed live at
`https://engelahealth.com/signin`. Oliver also signed Supabase's DPA, confirming this project as
processing UK GDPR Article 9 special-category (health) data.

**Open follow-on:** `www.engelahealth.com` currently resolves nowhere (no DNS record since the old
parking CNAME was removed and nothing replaced it) — decide whether `www` should redirect to the
apex or serve the app directly, then wire it up. Region is still `eu-west-1` (Ireland) vs the
decision log's stated London preference — unresolved, revisit before real patient data.

**Migration/secret/DNS implication:** No schema change. DNS zone changed (see above); no GitHub
secrets changed.

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
