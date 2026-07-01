# Setup & provisioning (things only Oliver can do)

Claude Code scaffolds the code; these steps need your accounts and cannot be automated from here.
Do them when you want the Phase 0 preview deploy live.

## 1. Supabase project (separate from the marketing site)

1. Create a **new** Supabase project in the **EU (London)** region. Do **not** reuse the marketing
   site's project — clinical special-category data stays isolated.
2. Sign Supabase's **Data Processing Addendum (DPA)**.
3. From the project settings, copy into secrets (never commit):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
4. Link the CLI and apply the schema:
   ```bash
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push
   pnpm exec supabase db query --file supabase/seed.sql
   pnpm db:types           # regenerate the typed schema from the live DB
   ```
5. **Compliance note:** MFA enforcement, point-in-time recovery and connection logging (needed in
   Phase 2) require a paid plan; the brief's HIPAA/BAA posture needs the Team plan (~$350/mo). UK
   GDPR + EU region is sufficient for launch — decide before Phase 2.

## 2. Access-token hook (role claim)

Add a Supabase **access-token hook** that copies each user's role into the token so middleware and
RLS can read it as `app_metadata.role`. (Wired with the invite flow in Phase 2; the schema's
`jwt_role()` helper already reads this claim.)

## 3. GitHub repo

1. Create a private repo `engela-platform`; push this project.
2. Protect `main` (require CI to pass; PRs only).
3. Add repo **secrets**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## 4. Cloudflare

1. A scoped **API token** (Workers deploy) + your **account ID** → GitHub secrets above.
2. First deploy runs from GitHub Actions (`deploy.yml`), not Workers Builds.

## 5. Domain

Point **app.engelahealth.co.uk** at the Cloudflare Worker (custom domain / route). The marketing
apex `engelahealth.co.uk` is unchanged.

## 6. Fonts

Fraunces and Hanken Grotesk are open-licence (loaded via `next/font/google`). No action needed.
