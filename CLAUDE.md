# CLAUDE.md — Engela Health Clinical Platform

> **Read this file first, in full, at the start of every session.** It is your persistent memory
> and operating manual. This project is the **clinical platform** (consultant console + client app
> + role-aware sign-in) at **app.engelahealth.co.uk**. The public marketing site is a **separate
> project** (`../engela-health`, engelahealth.co.uk) and is not touched from here.

---

## 0. WHAT THIS IS

The authenticated product behind the Engela Health sign-in: a **consultant console** (desktop) and
a **client app** (phone-first), backed by Supabase, seeded from the demo's worked example (patient
**HCA-MM-0142, week 32**). Source of truth for look and interaction is the design demo
(`design_handoff_weekly_consultant_review/`), and the platform brief
(`Engela_Health_Web_Platform_Build_Handover.docx`).

**This handles special-category (UK GDPR Article 9) health data.** Security, least-disclosure and
consent are core requirements, not polish. When unsure, choose the safer, more private option.

---

## 1. STACK (do not substitute without explicit approval)

- **TypeScript** (strict) · **Next.js App Router** · **Node.js runtime only** (never `edge`)
- **CSS Modules + `src/styles/tokens.css`** design tokens — no hard-coded colours (mirrors the
  marketing repo's conventions). **Not Tailwind.** (The brief recommended Tailwind/Vercel; the
  client chose to keep this repo's CSS-Modules + Cloudflare stack.)
- **Supabase** — a **separate project** from the marketing site, **EU (London) region**
- **Cloudflare Workers** via `@opennextjs/cloudflare` (OpenNext). **Not Vercel.**
- **pnpm** only. Fonts: **Fraunces** (display/scores) + **Hanken Grotesk** (body + all numbers).
- Charts: custom SVG to match the demo (Recharts allowed if a drill-down needs it).

### Hard constraints
- No `export const runtime = "edge"` anywhere. `wrangler.jsonc` keeps `nodejs_compat` + a recent
  compatibility date. Keep heavy SDKs server-only; watch the Worker bundle size limit.
- Secrets are **never** committed and **never** `NEXT_PUBLIC_` unless truly public.
  `SUPABASE_SERVICE_ROLE_KEY` is server-only. `lib/env.ts` (Zod) validates env at boot.

---

## 2. NON-NEGOTIABLE SAFETY RULES (load-bearing — never weaken to "make it work")

1. **RLS on every table, deny-by-default.** Clients read only their own safe data. Clinicians read
   a client only if on that client's `care_team`. The service-role key stays on the server.
2. **The client app never shows** a raw lab value, a disease marker, an MRD result, or a red /
   "flag"-styled warning. Those stay on the console. Enforced in data: `labs` is consultant-only;
   `actions_flags.client_visible` gates the app; a safety flag (`is_flag`) is never client-visible;
   `weekly_reviews.context` (holds MRD etc.) is clinical-only — clients get a SECURITY DEFINER
   client-safe projection, never direct table access.
3. **Estimate/wearable metrics** (VO2 max, HRV, sleep) carry a visible "estimate, not a lab
   measure" caveat everywhere a value appears. (`metrics_catalog.is_estimate`.)
4. **Sign-off is an audited event** — writes signer + timestamp to `weekly_reviews` and appends to
   the append-only `audit_log`; a read-only audit-trail screen exists for the clinical team.
5. **Status logic is identical on both surfaces, different loudness.** Colour is by *direction of
   clinical benefit*, not raw sign (falling resting-HR = concern; falling visceral fat = good).
   **Never colour alone** — always colour + dot + text label (WCAG 2.2 AA).
6. **Rehabilitation monitoring tool, not a diagnostic device** — state it in-product.
7. **Copy**: plain British English, **no em/en dashes** in interface copy (use commas, colons, or
   "to" for ranges). Client copy is warm, second person, frames pausing/easing as protective.

---

## 3. AUTH & ROLES

- Supabase Auth. Roles: `consultant | nurse | cep | client | admin`. Clinical team = consultant,
  nurse, cep (+admin). Role travels as an **access-token claim** (access-token hook →
  `app_metadata.role`) so middleware and RLS read it without an extra query.
- **Invite-only** onboarding (rehab-lead-sent signed invite links). Nobody self-registers into a
  clinical role. Clinical accounts require **TOTP MFA**.
- `src/middleware.ts` refreshes the session and gates: `/console/*` clinical only, `/app/*` clients
  only, unauth → `/signin`. Middleware is a usability gate; **RLS is the real security boundary.**

---

## 4. CONVENTIONS

- **Modularity.** Features under `src/features/<feature>/` with `index.ts`. No cross-feature imports
  except via `components/ui`, `lib/`, `types/`.
- **Tokens only.** All colour/spacing/type/radii from `src/styles/tokens.css`.
- **Validation.** One shared Zod schema per form (client + server); server is authoritative.
- **Supabase clients.** `client.ts` (browser), `server.ts` (cookie/RLS, request scope),
  `admin.ts` `getAdminClient()` (service-role factory, server-only, call inside handlers only).
- **Migrations are append-only.** New file per change; never edit an applied migration. Regenerate
  `src/types/database.types.ts` via `pnpm db:types` after schema changes; re-verify RLS default-deny.
- **Commits**: Conventional Commits. Small, reviewable PRs — one feature/screen per PR. Never push
  to `main`. CI (typecheck/lint/test/audit/build) must pass. Update `CHANGELOG.md` every change.
- No `dangerouslySetInnerHTML` with user content. No secrets in client code.

---

## 5. BUILD PHASES (GitHub milestones)

- **Phase 0 — Foundations** ✅ *scaffold in progress.* Repo, tokens, CSS system, Supabase clients,
  env, auth/middleware skeleton, CI, schema + RLS, metrics_catalog seed, placeholder routes.
  **Gate: preview deploy live.**
- **Phase 1 — MVP.** Functional role-aware sign-in; console read-only rendering seed patient exactly
  as the demo; client home ("calm hero" 1a); full patient seed. **Gate: a clinician and a client
  each sign in and see the correct surface; a client cannot load another record (refused by RLS).**
- **Phase 2 — Clinical core.** Metric drill-down (target band, clinical note, estimate caveat);
  persisted audited sign-off + audit-trail screen; invite flow; TOTP MFA; RLS hardening + tests.
  **Gate: sign-off persists and writes an audit entry.**
- **Phase 3 — Client depth.** Pillar detail, progress, tickable actions, "message Ollie";
  empty/paused/no-baseline/not-measured states + skeletons. **Gate: client app complete.**
- **Phase 4 — Premium.** Per brief §13: native app, wearables, messaging, payments, notifications,
  multi-clinic. Each is a product decision to confirm first.

---

## 6. DECISIONS LOG (keep current)

- `2026-07-01` — Platform built as a **separate project** from the marketing site (own repo, app
  subdomain). Marketing stays on its teal brand; this app uses the demo's clinical brand
  (Slate `#2E5077` / Amber `#FFA630` / Navy `#001A38` / Cream `#FDFBF7`, Fraunces + Hanken).
- `2026-07-01` — Stack kept as **CSS Modules + Cloudflare Workers** (not the brief's Tailwind/Vercel).
- `2026-07-01` — **Separate Supabase project**, EU/London, for clinical special-category data
  (not shared with the marketing enquiries DB). *(Confirm + create — see docs/SETUP.md.)*

## 7. OPEN ITEMS — confirm, don't guess (working defaults in brackets)

| # | Item | Default until confirmed |
|---|---|---|
| 1 | Supabase project + region | New project, EU/London — **needs creating** |
| 2 | Compliance target (UK GDPR vs HIPAA add-on) | UK GDPR + EU region for launch; HIPAA deferred |
| 3 | Client onboarding | Invite-only (rehab-lead email invite) |
| 4 | Clinician auth | Email/password + TOTP (SSO deferred) |
| 5 | Client app launch scope | Home only (Phase 1); depth in Phase 3 |
| 6 | Second PR reviewer on data-access changes | Recommended; Oliver's call |
| 7 | Pillar ring threshold (amber<8.0, slate≥8.0) | Demo default — confirm with rehab lead |
| 8 | Real metric wording / clinical notes | Demo copy is placeholder — clinical sign-off needed |

See `docs/SETUP.md` for the accounts/secrets/DNS Oliver must provision (Supabase, GitHub repo,
Cloudflare, domain).
