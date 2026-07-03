import type { Metadata } from "next";
import { Sidebar } from "@/features/console";
import {
  OverviewView,
  ProgramHeader,
  getClientProgram,
  getPerformanceOverview,
} from "@/features/programs";
import { getProgramsPageContext } from "./common";
import styles from "@/features/programs/programs.module.css";

export const metadata: Metadata = {
  title: "Exercise overview",
};

// Supabase reads are per-request (cookie-scoped RLS) — never prerender.
export const dynamic = "force-dynamic";

/**
 * Exercise overview: strength, cardiovascular and mobility trends across the
 * client's completed sessions, plus adherence. First of the four programme
 * pages (overview, blocks, sessions, planning).
 */
export default async function ProgramsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const { patient } = await searchParams;
  const ctx = await getProgramsPageContext(patient);

  const [overview, program] = ctx.selected
    ? await Promise.all([
        getPerformanceOverview(ctx.selected.clientId),
        getClientProgram(ctx.selected.clientId),
      ])
    : [null, null];

  return (
    <div className={styles.shell}>
      <Sidebar
        roster={ctx.roster}
        viewerName={ctx.viewerName}
        selectedId={ctx.selected?.clientId}
        activeNav="programs"
        rosterBasePath="/console/programs"
      />
      <main className={styles.main}>
        <ProgramHeader patient={ctx.selected} active="overview" />
        {ctx.selected && overview ? <OverviewView overview={overview} program={program} /> : null}
      </main>
    </div>
  );
}
