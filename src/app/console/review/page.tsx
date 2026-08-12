import type { Metadata } from "next";
import {
  ConsoleView,
  getLatestReview,
  getMetricOptions,
  getClientStatus,
  getReviewDraft,
  getReviewWeeks,
  getRoster,
} from "@/features/console";
import { ReportsPanel, getClientReports } from "@/features/reports";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Weekly review",
};

// Supabase reads are per-request (cookie-scoped RLS) — never prerender.
export const dynamic = "force-dynamic";

/**
 * Consultant weekly review (clinical team only; middleware gates the route, RLS
 * scopes the data to the signed-in clinician's care team). Renders the roster
 * and the selected patient's review: the week asked for, else their latest.
 *
 * A patient with no review yet still lands here, on the panel that conducts
 * their first one. Reports are composed in from their own feature so the two
 * stay independent.
 */
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string; week?: string }>;
}) {
  const { patient, week } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Clinical team";
  // Sign-off is the consultant's act; admin can stand in. Conducting a review
  // and recording against it is open to the whole clinical team.
  const viewerRole = user?.app_metadata?.role;
  const viewerCanSignOff = viewerRole === "consultant" || viewerRole === "admin";

  const roster = await getRoster();
  const selected = roster.find((r) => r.clientId === patient) ?? roster[0];
  const weekNo = week != null && /^\d+$/.test(week) ? Number(week) : undefined;

  const [review, weeks, draft, clientStatus, metricOptions, reports] = await Promise.all([
    selected ? getLatestReview(selected.clientId, weekNo) : Promise.resolve(null),
    selected ? getReviewWeeks(selected.clientId) : Promise.resolve([]),
    selected ? getReviewDraft(selected.clientId) : Promise.resolve(null),
    selected ? getClientStatus(selected.clientId) : Promise.resolve(null),
    getMetricOptions(),
    selected ? getClientReports(selected.clientId) : Promise.resolve([]),
  ]);

  return (
    <ConsoleView
      roster={roster}
      review={review}
      selectedClient={
        selected ? { clientId: selected.clientId, fullName: selected.fullName } : null
      }
      draft={draft}
      clientStatus={clientStatus}
      weeks={weeks}
      viewerName={viewerName}
      viewerCanSignOff={viewerCanSignOff}
      metricOptions={metricOptions}
      reportsSlot={
        selected ? (
          <ReportsPanel
            clientId={selected.clientId}
            reviewId={review?.reviewId ?? null}
            weekNo={review?.weekNo ?? null}
            reports={reports}
          />
        ) : null
      }
    />
  );
}
