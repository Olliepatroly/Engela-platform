import {
  CancelRequestButton,
  InviteClientButton,
  PeerInviteForm,
  RespondForm,
} from "./RequestControls";
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

function describeOutgoing(r: TeamRequestVM): string {
  if (r.kind === "clinician_invite") return `You invited ${r.clientName} into your care.`;
  if (r.kind === "peer_invite")
    return `You invited ${r.clinicianName} to ${r.clientName}'s team.`;
  return `You asked ${r.clinicianName} to join your community.`;
}

const RESOLVED_LABELS: Record<string, string> = {
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Withdrawn",
};

/**
 * Find people: directory search for the clinical team. Invite a client into
 * your care, or invite a fellow community member to a client's team. Every
 * team change still ends with the client's own consent controls.
 */
export function ConsoleSearchView({
  q,
  results,
  requests,
  myClientIds,
  rosterClients,
  viewerId,
}: {
  q: string;
  results: DirectoryEntry[];
  requests: TeamRequestVM[];
  myClientIds: Set<string>;
  rosterClients: { clientId: string; fullName: string }[];
  viewerId: string;
}) {
  const pending = requests.filter((r) => r.status === "pending");
  const incoming = pending.filter((r) => r.clinicianId === viewerId && r.requestedBy !== viewerId);
  const outgoing = pending.filter((r) => r.requestedBy === viewerId);
  const recent = requests.filter((r) => r.status !== "pending").slice(0, 5);

  const pendingWith = (entry: DirectoryEntry) =>
    pending.some((r) =>
      entry.kind === "client" ? r.clientId === entry.id : r.clinicianId === entry.id,
    );

  return (
    <>
      <header className={styles.banner}>
        <div>
          <h1 className={styles.pageTitle}>Find people</h1>
          <p className={styles.pageSub}>
            Search for clients and fellow community members. Adding someone to a team always ends
            with the client&rsquo;s consent.
          </p>
        </div>
      </header>

      <form className={styles.searchForm} method="GET" action="/console/search">
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
        <section className={styles.panel} aria-label="Search results">
          <h2 className={styles.panelTitle}>Results</h2>
          {results.length === 0 ? (
            <p className={styles.mutedNote}>Nobody matches that name.</p>
          ) : (
            <ul className={styles.resultList}>
              {results.map((entry) => (
                <li key={`${entry.kind}-${entry.id}`} className={styles.resultRow}>
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
                    {entry.kind === "client" ? (
                      myClientIds.has(entry.id) ? (
                        <span className={styles.statusChip}>On your team</span>
                      ) : pendingWith(entry) ? (
                        <span className={styles.statusChip}>Request pending</span>
                      ) : (
                        <InviteClientButton clientId={entry.id} />
                      )
                    ) : (
                      <PeerInviteForm clinicianId={entry.id} clients={rosterClients} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className={styles.panel} aria-label="Requests for you">
        <h2 className={styles.panelTitle}>Requests for you</h2>
        {incoming.length === 0 ? (
          <p className={styles.mutedNote}>Nothing waiting for your answer.</p>
        ) : (
          <ul className={styles.requestList}>
            {incoming.map((r) => (
              <li key={r.id} className={styles.requestRow}>
                <div className={styles.resultInfo}>
                  <span className={styles.resultName}>
                    {r.kind === "client_request"
                      ? `${r.clientName} asked you to join their community.`
                      : `${r.requestedByName} invited you to ${r.clientName}'s team.`}
                  </span>
                  {r.message ? <span className={styles.resultMeta}>“{r.message}”</span> : null}
                  {r.kind === "peer_invite" ? (
                    <span className={styles.resultMeta}>
                      If you accept, sharing stays paused until the client turns it on.
                    </span>
                  ) : null}
                </div>
                <RespondForm requestId={r.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {outgoing.length > 0 ? (
        <section className={styles.panel} aria-label="Sent by you">
          <h2 className={styles.panelTitle}>Sent by you</h2>
          <ul className={styles.requestList}>
            {outgoing.map((r) => (
              <li key={r.id} className={styles.requestRow}>
                <div className={styles.resultInfo}>
                  <span className={styles.resultName}>{describeOutgoing(r)}</span>
                  <span className={styles.resultMeta}>Waiting for an answer</span>
                </div>
                <CancelRequestButton requestId={r.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {recent.length > 0 ? (
        <section className={styles.panel} aria-label="Recently resolved">
          <h2 className={styles.panelTitle}>Recently resolved</h2>
          <ul className={styles.requestList}>
            {recent.map((r) => (
              <li key={r.id} className={styles.requestRow}>
                <div className={styles.resultInfo}>
                  <span className={styles.resultMeta}>
                    {r.kind === "client_request"
                      ? `${r.clientName} → ${r.clinicianName}`
                      : r.kind === "peer_invite"
                        ? `${r.requestedByName} → ${r.clinicianName} (${r.clientName})`
                        : `${r.clinicianName} → ${r.clientName}`}
                  </span>
                </div>
                <span className={styles.statusChip}>{RESOLVED_LABELS[r.status] ?? r.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
