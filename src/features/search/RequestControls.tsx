"use client";

import { useActionState } from "react";
import {
  cancelRequest,
  inviteClient,
  invitePeer,
  requestMember,
  respondToRequest,
  type SearchActionState,
} from "./actions";
import styles from "./search.module.css";

const initial: SearchActionState = { error: null, success: null };

function Feedback({ state }: { state: SearchActionState }) {
  if (state.error) {
    return (
      <p className={styles.feedbackError} role="alert">
        {state.error}
      </p>
    );
  }
  if (state.success) return <p className={styles.feedbackSuccess}>{state.success}</p>;
  return null;
}

/** Client asks a community member to join their team. */
export function RequestMemberButton({ clinicianId }: { clinicianId: string }) {
  const [state, action, pending] = useActionState(requestMember, initial);
  return (
    <form className={styles.controlForm} action={action}>
      <input type="hidden" name="clinicianId" value={clinicianId} />
      <button className={styles.primaryBtn} type="submit" disabled={pending || !!state.success}>
        {pending ? "Sending…" : state.success ? "Requested" : "Ask to join your community"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

/** Community member invites a client into their care. */
export function InviteClientButton({ clientId }: { clientId: string }) {
  const [state, action, pending] = useActionState(inviteClient, initial);
  return (
    <form className={styles.controlForm} action={action}>
      <input type="hidden" name="clientId" value={clientId} />
      <button className={styles.primaryBtn} type="submit" disabled={pending || !!state.success}>
        {pending ? "Sending…" : state.success ? "Invited" : "Invite to your care"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

/** Community member invites a fellow member to one of their clients' teams. */
export function PeerInviteForm({
  clinicianId,
  clients,
}: {
  clinicianId: string;
  clients: { clientId: string; fullName: string }[];
}) {
  const [state, action, pending] = useActionState(invitePeer, initial);
  if (clients.length === 0) {
    return <p className={styles.mutedNote}>Join a client&rsquo;s team first to invite others.</p>;
  }
  return (
    <form className={styles.controlForm} action={action}>
      <input type="hidden" name="clinicianId" value={clinicianId} />
      <div className={styles.peerRow}>
        <select className={styles.select} name="clientId" required defaultValue="">
          <option value="" disabled>
            For which client&rsquo;s team?
          </option>
          {clients.map((c) => (
            <option key={c.clientId} value={c.clientId}>
              {c.fullName}
            </option>
          ))}
        </select>
        <button className={styles.primaryBtn} type="submit" disabled={pending || !!state.success}>
          {pending ? "Sending…" : state.success ? "Invited" : "Invite"}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/** Accept or decline an incoming request. */
export function RespondForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(respondToRequest, initial);
  return (
    <form className={styles.controlForm} action={action}>
      <input type="hidden" name="requestId" value={requestId} />
      <div className={styles.respondRow}>
        <button
          className={styles.primaryBtn}
          type="submit"
          name="decision"
          value="accept"
          disabled={pending || !!state.success}
        >
          Accept
        </button>
        <button
          className={styles.quietBtn}
          type="submit"
          name="decision"
          value="decline"
          disabled={pending || !!state.success}
        >
          Decline
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/** The sender withdraws a pending request. */
export function CancelRequestButton({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(cancelRequest, initial);
  return (
    <form className={styles.controlForm} action={action}>
      <input type="hidden" name="requestId" value={requestId} />
      <button className={styles.quietBtn} type="submit" disabled={pending || !!state.success}>
        {pending ? "Withdrawing…" : state.success ? "Withdrawn" : "Withdraw"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
