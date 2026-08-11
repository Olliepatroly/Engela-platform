import type { Metadata } from "next";
import {
  ConsoleView,
  getClientReports,
  getClientSummary,
  getLatestReview,
  getMetricOptions,
  getRoster,
} from "@/features/console";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Weekly review",
};

// Supabase reads are per-request (cookie-scoped RLS) — never prerender.
export const dynamic = "force-dynamic";

/**
 * Consultant weekly review (clinical team only; middleware gates the route, RLS
 * scopes the data to the signed-in clinician's care team). Renders the roster
 * and the selected patient's latest weekly review, or, when they have none yet,
 * the controls to conduct one.
 */
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const { patient } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Clinical team";
  // Sign-off is the consultant's act; admin can stand in. Conducting a review
  // and filing a report are open to every clinical role.
  const viewerRole = user?.app_metadata?.role;
  const viewerCanSignOff = viewerRole === "consultant" || viewerRole === "admin";

  const roster = await getRoster();
  const selectedId = patient ?? roster[0]?.clientId;
  const [review, client, reports, metricOptions] = await Promise.all([
    selectedId ? getLatestReview(selectedId) : Promise.resolve(null),
    selectedId ? getClientSummary(selectedId) : Promise.resolve(null),
    selectedId ? getClientReports(selectedId) : Promise.resolve([]),
    getMetricOptions(),
  ]);

  return (
    <ConsoleView
      roster={roster}
      review={review}
      client={client}
      reports={reports}
      viewerName={viewerName}
      viewerCanSignOff={viewerCanSignOff}
      metricOptions={metricOptions}
    />
  );
}
