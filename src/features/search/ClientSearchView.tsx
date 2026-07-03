import { CancelRequestButton, RequestMemberButton, RespondForm } from "./RequestControls";
import { ROLE_LABELS, type DirectoryEntry, type TeamRequestVM } from "./data";
import styles from "./search.module.css";

function initials(name: string): string {
  return name
    .split(" ")
    .filter((part) => part && part !== "Dr")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Grow your community: the client searches for consultants, physios, nurses
 * and exercise physiologists and asks them to join their team. Invites from
 * members arrive here too; the client always decides.
 */
export function ClientSearchView({
  q,
  results,
  requests,
  teamMemberIds,
}: {
  q: string;
  results: DirectoryEntry[];
  requests: TeamRequestVM[];
  teamMemberIds: Set<string>;
}) {
  const pending = requests.filter((r) => r.status === "pending");
  const invites = pending.filter((r) => r.kind === "clinician_invite");
  const myRequests = pending.filter((r) => r.kind === "client_request");
  const pendingMemberIds = new Set(pending.map((r) => r.clinicianId));

  return (
    <div className={styles.clientWrap}>
      {invites.length > 0 ? (
        <section className={styles.clientPanel} aria-label="Invites for you">
          <h2 className={styles.clientPanelTitle}>Invites for you</h2>
          <ul className={styles.requestList}>
            {invites.map((r) => (
              <li key={r.id} className={styles.requestRow}>
                <div className={styles.resultInfo}>
                  <span className={styles.resultName}>
                    {r.clinicianName} would like to join your community
                  </span>
                  <span className={styles.resultMeta}>
                    {r.clinicianDiscipline ?? ROLE_LABELS[r.clinicianRole ?? ""] ?? "Community member"}
                  </span>
                  {r.message ? <span className={styles.resultMeta}>“{r.message}”</span> : null}
                </div>
                <RespondForm requestId={r.id} />
              </li>
            ))}
          </ul>
          <p className={styles.mutedNote}>
            Accepting adds them to your community and lets them follow your progress. You can pause
            sharing at any time above.
          </p>
        </section>
      ) : null}

      <section className={styles.clientPanel} aria-label="Find a specialist">
        <h2 className={styles.clientPanelTitle}>Find a specialist</h2>
        <p className={styles.mutedNote}>
          Search for consultants, physiotherapists, nurses and exercise physiologists, and ask them
          to join your community.
        </p>
        <form className={styles.searchForm} method="GET" action="/app/community">
          <input
            className={styles.searchInput}
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name"
            aria-label="Search by name"
          />
          <button className={styles.primaryBtn} type="submit">
            Search
          </button>
        </form>

        {q.trim().length >= 2 ? (
          results.length === 0 ? (
            <p className={styles.mutedNote}>Nobody matches that name yet.</p>
          ) : (
            <ul className={styles.resultList}>
              {results.map((entry) => (
                <li key={entry.id} className={styles.resultRow}>
                  <span className={styles.avatar} aria-hidden="true">
                    {initials(entry.fullName)}
                  </span>
                  <div className={styles.resultInfo}>
                    <span className={styles.resultName}>{entry.fullName}</span>
                    <span className={styles.resultMeta}>
                      {entry.discipline ?? ROLE_LABELS[entry.role] ?? entry.role}
                    </span>
                  </div>
                  <div className={styles.resultActions}>
                    {teamMemberIds.has(entry.id) ? (
                      <span className={styles.statusChip}>In your community</span>
                    ) : pendingMemberIds.has(entry.id) ? (
                      <span className={styles.statusChip}>Requested</span>
                    ) : (
                      <RequestMemberButton clinicianId={entry.id} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>

      {myRequests.length > 0 ? (
        <section className={styles.clientPanel} aria-label="Your requests">
          <h2 className={styles.clientPanelTitle}>Your requests</h2>
          <ul className={styles.requestList}>
            {myRequests.map((r) => (
              <li key={r.id} className={styles.requestRow}>
                <div className={styles.resultInfo}>
                  <span className={styles.resultName}>{r.clinicianName}</span>
                  <span className={styles.resultMeta}>Waiting for their answer</span>
                </div>
                <CancelRequestButton requestId={r.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
