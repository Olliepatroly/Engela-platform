import type { Metadata } from "next";
import { ConsoleView, getLatestReview, getMetricOptions, getRoster } from "@/features/console";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Clinical Console",
};

// Supabase reads are per-request (cookie-scoped RLS) — never prerender.
export const dynamic = "force-dynamic";

/**
 * Consultant console (clinical team only; middleware gates the route, RLS
 * scopes the data to the signed-in clinician's care team). Renders the roster
 * and the selected patient's latest weekly review.
 */
export default async function ConsolePage({
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
  // Sign-off is the consultant's act; admin can stand in.
  const viewerRole = user?.app_metadata?.role;
  const viewerCanSignOff = viewerRole === "consultant" || viewerRole === "admin";

  const roster = await getRoster();
  const selectedId = patient ?? roster[0]?.clientId;
  const [review, metricOptions] = await Promise.all([
    selectedId ? getLatestReview(selectedId) : Promise.resolve(null),
    getMetricOptions(),
  ]);

  return (
    <ConsoleView
      roster={roster}
      review={review}
      viewerName={viewerName}
      viewerCanSignOff={viewerCanSignOff}
      metricOptions={metricOptions}
    />
  );
}
