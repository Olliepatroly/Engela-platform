import Link from "next/link";
import styles from "./programs.module.css";

export type ProgramTab = "overview" | "blocks" | "sessions" | "planning";

export type ProgramPatient = { clientId: string; fullName: string; mrn: string };

const TABS: { key: ProgramTab; label: string; path: string }[] = [
  { key: "overview", label: "Exercise overview", path: "/console/programs" },
  { key: "blocks", label: "Blocks", path: "/console/programs/blocks" },
  { key: "sessions", label: "Sessions", path: "/console/programs/sessions" },
  { key: "planning", label: "Planning", path: "/console/programs/planning" },
];

/**
 * Patient banner + the four programme pages (overview, blocks, sessions,
 * planning), shared by every page in the programmes area.
 */
export function ProgramHeader({
  patient,
  active,
}: {
  patient: ProgramPatient | null;
  active: ProgramTab;
}) {
  if (!patient) {
    return (
      <div className={styles.empty}>
        <h1 className={styles.emptyHeading}>Exercise programmes</h1>
        <p className={styles.emptyNote}>Select a patient from the roster to see their programme.</p>
      </div>
    );
  }

  return (
    <>
      <header className={styles.banner}>
        <div>
          <h1 className={styles.patientName}>{patient.fullName}</h1>
          <p className={styles.patientMeta}>{patient.mrn} · Exercise programme</p>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Programme pages">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`${tab.path}?patient=${patient.clientId}`}
            className={`${styles.tab} ${tab.key === active ? styles.tabActive : ""}`}
            aria-current={tab.key === active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
