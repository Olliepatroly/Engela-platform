import Link from "next/link";
import { StatusPill } from "@/components/ui";
import { Sidebar } from "./Sidebar";
import { ScoreRadar } from "./ScoreRadar";
import type { HomeOverviewVM, RosterEntry, PillarSectionVM } from "./data";
import type { FlagVM } from "@/features/flags";
import styles from "./home.module.css";

export type FeaturedRadar = {
  clientId: string;
  name: string;
  mrn: string;
  week: number | null;
  composite: number | null;
  pillars: PillarSectionVM[];
};

function firstName(name: string): string {
  const parts = name.split(" ").filter((p) => p && p !== "Dr");
  return parts[parts.length - 1] ?? name;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The clinical home: where every clinical account lands after sign-in. It leads
 * with the unchecked flags queue (safety first), then the shape of the team's
 * work: how many clients the viewer carries and the wider clinical team by
 * discipline. All figures are RLS scoped to the viewer's care team; the flags
 * shown are a preview that links through to the full queue for action.
 */
export function HomeView({
  roster,
  overview,
  openFlags,
  viewerName,
  featured,
}: {
  roster: RosterEntry[];
  overview: HomeOverviewVM;
  openFlags: FlagVM[];
  viewerName: string;
  /** A client's outcome radar, previewed on the home for trialling. */
  featured?: FeaturedRadar | null;
}) {
  const flagPreview = openFlags.slice(0, 5);

  return (
    <div className={styles.shell}>
      <Sidebar roster={roster} viewerName={viewerName} activeNav="home" />

      <main className={styles.main}>
        <header className={styles.banner}>
          <div>
            <h1 className={styles.heading}>Good to see you, {firstName(viewerName)}</h1>
            <p className={styles.subhead}>
              Your clinical home. Unchecked flags come first, then your clients and team.
            </p>
          </div>
        </header>

        {/* Overview tiles ─ care-team scoped counts. */}
        <section className={styles.tiles} aria-label="Overview">
          <div className={styles.tile}>
            <span className={styles.tileValue}>{overview.activeClients}</span>
            <span className={styles.tileLabel}>Active clients</span>
            <span className={styles.tileCaption}>
              {overview.totalClients} on your care team
            </span>
          </div>
          <Link
            href="/console/flags"
            className={`${styles.tile} ${styles.tileLink} ${
              openFlags.length > 0 ? styles.tileAlert : ""
            }`}
          >
            <span className={styles.tileValue}>{openFlags.length}</span>
            <span className={styles.tileLabel}>Unchecked flags</span>
            <span className={styles.tileCaption}>
              {openFlags.length === 0 ? "Nothing waiting" : "Review the queue"}
            </span>
          </Link>
          <div className={styles.tile}>
            <span className={styles.tileValue}>{overview.flaggedClients}</span>
            <span className={styles.tileLabel}>Flagged reviews</span>
            <span className={styles.tileCaption}>Latest week marked flag</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileValue}>
              {overview.team.reduce((n, g) => n + g.members.length, 0)}
            </span>
            <span className={styles.tileLabel}>Clinical team</span>
            <span className={styles.tileCaption}>Across all disciplines</span>
          </div>
        </section>

        {/* Unchecked recent flags ─ safety first. */}
        <section className={styles.panel} aria-label="Unchecked flags">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Unchecked flags</h2>
            <Link href="/console/flags" className={styles.panelLink}>
              View all flags
            </Link>
          </div>

          {flagPreview.length === 0 ? (
            <p className={styles.emptyNote}>
              No flags waiting for your clients. That is a good week.
            </p>
          ) : (
            <ul className={styles.flagList}>
              {flagPreview.map((flag) => (
                <li
                  key={flag.id}
                  className={`${styles.flagRow} ${
                    flag.tier === "major" ? styles.flagRowMajor : styles.flagRowMinor
                  }`}
                >
                  <div className={styles.flagTop}>
                    <span className={styles.flagWho}>
                      {flag.clientName} <span className={styles.flagMeta}>{flag.mrn}</span>
                    </span>
                    <StatusPill
                      status={flag.tier === "major" ? "flag" : "watch"}
                      label={flag.tier === "major" ? "Major concern" : "Minor concern"}
                    />
                  </div>
                  <p className={styles.flagMeta}>
                    Raised by {flag.raisedByName}
                    {flag.raisedRole === "client" ? " (client)" : ""} · {formatWhen(flag.createdAt)}
                  </p>
                  {flag.summary ? <p className={styles.flagSummary}>{flag.summary}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Featured client radar ─ a preview of the weekly outcome graph. */}
        {featured ? (
          <ScoreRadar
            pillars={featured.pillars}
            composite={featured.composite}
            heading={`Outcome radar · ${featured.name}`}
            note={`${featured.mrn}${
              featured.week != null ? ` · Week ${featured.week}` : ""
            }. A preview of this client's weekly graph. Select a point to open its history.`}
            footer={
              <Link
                href={`/console/review?patient=${featured.clientId}`}
                className={styles.radarFooterLink}
              >
                Open weekly review
              </Link>
            }
          />
        ) : null}

        {/* Team overview ─ colleagues by discipline. */}
        <section className={styles.panel} aria-label="Clinical team">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Clinical team</h2>
            <Link href="/console/search" className={styles.panelLink}>
              Find people
            </Link>
          </div>

          {overview.team.length === 0 ? (
            <p className={styles.emptyNote}>No colleagues to show yet.</p>
          ) : (
            <div className={styles.teamGrid}>
              {overview.team.map((group) => (
                <div key={group.role} className={styles.teamGroup}>
                  <p className={styles.teamHeading}>
                    {group.label} <span className={styles.teamCount}>{group.members.length}</span>
                  </p>
                  <ul className={styles.teamMembers}>
                    {group.members.map((member) => (
                      <li key={member.id} className={styles.teamMember}>
                        {member.fullName}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className={styles.disclaimer}>
          Rehabilitation monitoring tool. Supports the medical team; it does not replace clinical
          care.
        </p>
      </main>
    </div>
  );
}
