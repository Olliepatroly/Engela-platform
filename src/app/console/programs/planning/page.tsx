import type { Metadata } from "next";
import { Sidebar } from "@/features/console";
import {
  PlanningView,
  ProgramHeader,
  getClientProgram,
  getExerciseLibrary,
} from "@/features/programs";
import { getProgramsPageContext } from "../common";
import styles from "@/features/programs/programs.module.css";

export const metadata: Metadata = {
  title: "Session and block planning",
};

export const dynamic = "force-dynamic";

/**
 * Session and block planning: the CEP starts blocks, adds sessions, puts
 * exercises into them and grows the shared exercise library.
 */
export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const { patient } = await searchParams;
  const ctx = await getProgramsPageContext(patient);

  const [program, library] = await Promise.all([
    ctx.selected ? getClientProgram(ctx.selected.clientId) : Promise.resolve(null),
    getExerciseLibrary(),
  ]);

  return (
    <div className={styles.shell}>
      <Sidebar
        roster={ctx.roster}
        viewerName={ctx.viewerName}
        selectedId={ctx.selected?.clientId}
        activeNav="programs"
        rosterBasePath="/console/programs/planning"
      />
      <main className={styles.main}>
        <ProgramHeader patient={ctx.selected} active="planning" />
        {ctx.selected ? (
          <PlanningView
            clientId={ctx.selected.clientId}
            program={program}
            library={library}
            canBuild={ctx.canBuild}
          />
        ) : null}
      </main>
    </div>
  );
}
