import type { Metadata } from "next";
import { HomeView, getHomeOverview, getLatestReview, getRoster } from "@/features/console";
import { getFlags } from "@/features/flags";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Clinical home",
};

// Supabase reads are per-request (cookie-scoped RLS) — never prerender.
export const dynamic = "force-dynamic";

/**
 * Clinical home — where every clinical account lands after sign-in (see
 * homePathForRole). Leads with the unchecked flags queue (safety first), then
 * the team's shape: clients carried and clinical colleagues by discipline.
 * Middleware gates the route to clinical roles; RLS scopes every figure to the
 * viewer's consented care team.
 */
export default async function ConsoleHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Clinical team";

  const [roster, flags] = await Promise.all([getRoster(), getFlags()]);
  const overview = await getHomeOverview(roster);
  const openFlags = flags.filter((flag) => flag.status === "open");

  // Preview one client's outcome radar on the home for trialling: prefer a
  // flagged client, else the first on the roster.
  const featuredEntry = roster.find((r) => r.reviewStatus === "flag") ?? roster[0];
  const featuredReview = featuredEntry ? await getLatestReview(featuredEntry.clientId) : null;
  const featured = featuredReview
    ? {
        clientId: featuredReview.patient.clientId,
        name: featuredReview.patient.fullName,
        mrn: featuredReview.patient.mrn,
        week: featuredReview.weekNo,
        composite: featuredReview.compositeScore,
        pillars: featuredReview.pillars,
      }
    : null;

  return (
    <HomeView
      roster={roster}
      overview={overview}
      openFlags={openFlags}
      viewerName={viewerName}
      featured={featured}
    />
  );
}
