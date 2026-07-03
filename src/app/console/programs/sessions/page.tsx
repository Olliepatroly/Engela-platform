import type { Metadata } from "next";
import { Sidebar } from "@/features/console";
import {
  ProgramHeader,
  SessionsView,
  getClientProgram,
  getExerciseLibrary,
  getSessionDetail,
} from "@/features/programs";
import { getProgramsPageContext } from "../common";
import styles from "@/features/programs/programs.module.css";

export const metadata: Metadata = {
  title: "Sessions",
};

export const dynamic = "force-dynamic";

/**
 * Upcoming and completed sessions; opening one shows the full breakdown
 * (exercises, prescription, muscles worked). CEPs and physios can mark parts
 * done for sessions they take with the client.
 */
export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string; session?: string }>;
}) {
  const { patient, session } = await searchParams;
  const ctx = await getProgramsPageContext(patient);

  const [program, sessionDetail, library] = await Promise.all([
    ctx.selected ? getClientProgram(ctx.selected.clientId) : Promise.resolve(null),
    session ? getSessionDetail(session) : Promise.resolve(null),
    getExerciseLibrary(),
  ]);

  return (
    <div className={styles.shell}>
      <Sidebar
        roster={ctx.roster}
        viewerName={ctx.viewerName}
        selectedId={ctx.selected?.clientId}
        activeNav="programs"
        rosterBasePath="/console/programs/sessions"
      />
      <main className={styles.main}>
        <ProgramHeader patient={ctx.selected} active="sessions" />
        {ctx.selected ? (
          <SessionsView
            clientId={ctx.selected.clientId}
            program={program}
            sessionDetail={
              sessionDetail && sessionDetail.clientId === ctx.selected.clientId
                ? sessionDetail
                : null
            }
            library={library}
            canBuild={ctx.canBuild}
            canComplete={ctx.canComplete}
          />
        ) : null}
      </main>
    </div>
  );
}
