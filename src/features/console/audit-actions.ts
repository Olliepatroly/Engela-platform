"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { isRole, isClinical } from "@/lib/roles";

/**
 * Record that a clinician exported (generated a PDF of) a slice of the audit
 * trail. Exporting governance data is itself a governance event, so it is
 * logged with the filters that were applied and how many rows were included.
 * The filter summary carries no client identifiers, only the human-readable
 * labels the exporter chose.
 */
export async function logAuditExport(summary: {
  filters: string;
  rowCount: number;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;
  if (!user || !isRole(role) || !isClinical(role)) return;

  const admin = getAdminClient();
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "audit.exported",
    entity: "audit_log",
    meta: { filters: summary.filters.slice(0, 300), row_count: summary.rowCount },
  });
}
