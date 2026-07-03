import type { Metadata } from "next";
import { Sidebar } from "@/features/console";
import {
  BlocksView,
  ProgramHeader,
  buildCalendar,
  calendarRange,
  getBlocks,
  getSessionsBetween,
} from "@/features/programs";
import { getProgramsPageContext } from "../common";
import styles from "@/features/programs/programs.module.css";

export const metadata: Metadata = {
  title: "Blocks",
};

export const dynamic = "force-dynamic";

/**
 * Blocks: a month calendar of every session with the active block's span
 * highlighted, plus the list of blocks (editable by the CEP).
 */
export default async function BlocksPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string; month?: string }>;
}) {
  const { patient, month } = await searchParams;
  const ctx = await getProgramsPageContext(patient);

  const todayIso = new Date().toISOString().slice(0, 10);
  const monthIso = month && /^\d{4}-\d{2}$/.test(month) ? month : todayIso.slice(0, 7);

  let calendar = null;
  let blocks = null;
  if (ctx.selected) {
    const { startIso, endIso } = calendarRange(monthIso);
    const [sessions, blockList] = await Promise.all([
      getSessionsBetween(ctx.selected.clientId, startIso, endIso),
      getBlocks(ctx.selected.clientId),
    ]);
    const active = blockList.find((b) => b.status === "active") ?? null;
    const activeRange =
      active && (active.startsOn ?? active.firstSession) && active.lastSession
        ? { start: (active.startsOn ?? active.firstSession)!, end: active.lastSession }
        : null;
    calendar = buildCalendar(monthIso, sessions, activeRange, todayIso);
    blocks = blockList;
  }

  return (
    <div className={styles.shell}>
      <Sidebar
        roster={ctx.roster}
        viewerName={ctx.viewerName}
        selectedId={ctx.selected?.clientId}
        activeNav="programs"
        rosterBasePath="/console/programs/blocks"
      />
      <main className={styles.main}>
        <ProgramHeader patient={ctx.selected} active="blocks" />
        {ctx.selected && calendar && blocks ? (
          <BlocksView
            clientId={ctx.selected.clientId}
            calendar={calendar}
            blocks={blocks}
            canBuild={ctx.canBuild}
          />
        ) : null}
      </main>
    </div>
  );
}
