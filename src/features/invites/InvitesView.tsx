"use client";

import { useActionState, useState } from "react";
import {
  createInvite,
  revokeInvite,
  markRequestHandled,
  type InviteState,
  type RequestState,
} from "./actions";
import type { InviteVM, AccountRequestVM } from "./data";
import styles from "./invites.module.css";

const inviteInitial: InviteState = { error: null, success: null, inviteUrl: null, emailSent: false };
const requestInitial: RequestState = { error: null, success: null };

const ROLE_LABELS: Record<string, string> = {
  consultant: "Consultant",
  nurse: "Specialist nurse",
  cep: "Clinical exercise physiologist",
  physio: "Physiotherapist",
  client: "Client",
};

/** Requested-role display text from the public form, mapped back to a role value. */
const REQUESTED_ROLE_VALUES: Record<string, string> = {
  Consultant: "consultant",
  Physiotherapist: "physio",
  "Clinical exercise physiologist": "cep",
  "Specialist nurse": "nurse",
};

const STATUS_LABELS: Record<InviteVM["status"], string> = {
  pending: "Pending",
  accepted: "Accepted",
  revoked: "Revoked",
  expired: "Expired",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

type Prefill = { fullName: string; email: string; role: string };

function RevokeButton({ inviteId }: { inviteId: string }) {
  const [state, action, pending] = useActionState(revokeInvite, requestInitial);
  return (
    <form action={action} className={styles.rowActions}>
      <input type="hidden" name="inviteId" value={inviteId} />
      {state.error ? <span className={styles.error}>{state.error}</span> : null}
      <button className={styles.smallButton} type="submit" disabled={pending}>
        {pending ? "Revoking…" : "Revoke"}
      </button>
    </form>
  );
}

function MarkHandledButton({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(markRequestHandled, requestInitial);
  return (
    <form action={action} className={styles.rowActions}>
      <input type="hidden" name="requestId" value={requestId} />
      {state.error ? <span className={styles.error}>{state.error}</span> : null}
      <button className={styles.smallButton} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Mark handled"}
      </button>
    </form>
  );
}

/**
 * Invitations screen: send a signed invite link, follow up create-account
 * requests, and see the state of every invitation you have sent. Invites are
 * the only way an account is created; the invited role is fixed by the
 * invitation.
 */
export function InvitesView({
  invites,
  requests,
  allowedRoles,
}: {
  invites: InviteVM[];
  requests: AccountRequestVM[];
  allowedRoles: string[];
}) {
  const [state, action, pending] = useActionState(createInvite, inviteInitial);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [role, setRole] = useState(allowedRoles.includes("client") ? "client" : allowedRoles[0]);

  const prefillFrom = (request: AccountRequestVM) => {
    const requested =
      request.path === "client"
        ? "client"
        : (REQUESTED_ROLE_VALUES[request.requestedRole ?? ""] ?? "client");
    const nextRole = allowedRoles.includes(requested) ? requested : "client";
    setPrefill({ fullName: request.fullName, email: request.email, role: nextRole });
    setRole(nextRole);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.heading}>Invitations</h1>
        <p className={styles.subhead}>
          Access is by invitation only: nobody self-registers, and the invited role is fixed by the
          invitation. Links are personal, single use, and expire after seven days.
        </p>
      </div>

      <section className={styles.panel} aria-label="Send an invitation">
        <h2 className={styles.panelTitle}>Send an invitation</h2>
        {/* key resets the uncontrolled fields when a request is pulled into the form */}
        <form className={styles.form} action={action} key={prefill ? prefill.email : "blank"}>
          <label className={styles.field}>
            <span className={styles.label}>Full name</span>
            <input
              className={styles.input}
              name="fullName"
              required
              defaultValue={prefill?.fullName ?? ""}
              placeholder="Their name"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input
              className={styles.input}
              type="email"
              name="email"
              required
              defaultValue={prefill?.email ?? ""}
              placeholder="them@example.com"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Role</span>
            <select
              className={styles.input}
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {allowedRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r] ?? r}
                </option>
              ))}
            </select>
          </label>
          {role === "client" ? (
            <>
              <label className={styles.field}>
                <span className={styles.label}>MRN (optional)</span>
                <input className={styles.input} name="mrn" placeholder="e.g. HCA-XX-0000" />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Diagnosis (optional)</span>
                <input
                  className={styles.input}
                  name="diagnosis"
                  placeholder="Starts the clinical record"
                />
              </label>
            </>
          ) : null}
          {state.error ? (
            <p className={styles.error} role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? <p className={styles.success}>{state.success}</p> : null}
          {state.inviteUrl ? (
            <div className={styles.linkBox}>
              <span className={styles.label}>Invitation link</span>
              <input
                className={styles.linkInput}
                readOnly
                value={state.inviteUrl}
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
          ) : null}
          <button className={styles.submit} type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create invitation"}
          </button>
        </form>
      </section>

      <section className={styles.panel} aria-label="Account requests">
        <h2 className={styles.panelTitle}>Account requests</h2>
        <p className={styles.panelNote}>
          Requests from the create-account page. Pull one into the form above to invite them, then
          mark it handled.
        </p>
        {requests.length === 0 ? (
          <p className={styles.emptyNote}>No open requests.</p>
        ) : (
          <div className={styles.rows}>
            {requests.map((request) => (
              <div key={request.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowName}>{request.fullName}</span>
                  <span className={styles.rowMeta}>
                    {request.email} · {request.path === "team" ? "Clinical team" : "Client"}
                    {request.requestedRole ? ` · ${request.requestedRole}` : ""} ·{" "}
                    {formatDate(request.createdAt)}
                  </span>
                </div>
                <div className={styles.rowActions}>
                  <button
                    className={styles.smallButton}
                    type="button"
                    onClick={() => prefillFrom(request)}
                  >
                    Use in form
                  </button>
                  <MarkHandledButton requestId={request.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.panel} aria-label="Invitations sent">
        <h2 className={styles.panelTitle}>Invitations sent</h2>
        {invites.length === 0 ? (
          <p className={styles.emptyNote}>No invitations yet.</p>
        ) : (
          <div className={styles.rows}>
            {invites.map((invite) => (
              <div key={invite.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowName}>{invite.fullName}</span>
                  <span className={styles.rowMeta}>
                    {invite.email} · {ROLE_LABELS[invite.role] ?? invite.role} · sent{" "}
                    {formatDate(invite.createdAt)}
                    {invite.status === "pending" ? ` · expires ${formatDate(invite.expiresAt)}` : ""}
                  </span>
                </div>
                <div className={styles.rowActions}>
                  <span
                    className={`${styles.statusChip} ${
                      invite.status === "accepted"
                        ? styles.statusAccepted
                        : invite.status === "pending"
                          ? styles.statusPending
                          : ""
                    }`}
                  >
                    {STATUS_LABELS[invite.status]}
                  </span>
                  {invite.status === "pending" ? <RevokeButton inviteId={invite.id} /> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
