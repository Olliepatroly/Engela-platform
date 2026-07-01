import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Factory that returns a service-role admin client — bypasses RLS entirely.
 * Call inside request handlers only, never at module level, so the build phase
 * (where Cloudflare Worker secrets are absent) does not fail.
 * NEVER import this in Client Components or expose it to the browser.
 * Reserved for controlled operations only (invites, audited server writes).
 */
export function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
