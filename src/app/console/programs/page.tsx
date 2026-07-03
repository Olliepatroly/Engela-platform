import type { Metadata } from "next";
import { Sidebar, getRoster } from "@/features/console";
import {
  ProgramsView,
  getClientProgram,
  getExerciseLibrary,
  getSessionDetail,
} from "@/features/programs";
import { createClient } from "@/lib/supabase/server";
import styles from "@/features/programs/programs.module.css";

export const metadata: Metadata = {
  title: "Exercise programmes",
};

// Supabase reads are per-request (cookie-scoped RLS) — never prerender.
export const dynamic = "force-dynamic";

/**
 * Exercise programmes for the clinical team. The whole care team views a
 * client's programme, sessions and history; CEPs (and admin) build: exercises,
 * programmes, sessions, prescriptions. RLS scopes every read to the care team.
 */
export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string; session?: string }>;
}) {
  const { patient, session } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Clinical team";
  const role = user?.app_metadata?.role as string | undefined;
  const canBuild = role === "cep" || role === "admin";

  const roster = await getRoster();
  const selectedId = patient ?? roster[0]?.clientId;
  const selected = roster.find((r) => r.clientId === selectedId) ?? null;

  const [program, sessionDetail, library] = await Promise.all([
    selectedId ? getClientProgram(selectedId) : Promise.resolve(null),
    session ? getSessionDetail(session) : Promise.resolve(null),
    getExerciseLibrary(),
  ]);

  return (
    <div className={styles.shell}>
      <Sidebar
        roster={roster}
        viewerName={viewerName}
        selectedId={selectedId}
        activeNav="programs"
        rosterBasePath="/console/programs"
      />
      <main className={styles.main}>
        <ProgramsView
          patient={
            selected
              ? { clientId: selected.clientId, fullName: selected.fullName, mrn: selected.mrn }
              : null
          }
          program={program}
          sessionDetail={
            sessionDetail && sessionDetail.clientId === selectedId ? sessionDetail : null
          }
          library={library}
          canBuild={canBuild}
        />
      </main>
    </div>
  );
}
