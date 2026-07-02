"use client";

import { useActionState } from "react";
import { setConsent, type AccountState } from "./actions";
import type { CareTeamMember } from "./AccountForms";
import styles from "./community.module.css";

const initial: AccountState = { error: null, success: null };

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
 * The community: the client's team presented as the people alongside them,
 * not a ward round. Sharing controls are real consent: pausing removes that
 * person's access in the database until it is resumed.
 */
export function CommunityView({ team }: { team: CareTeamMember[] }) {
  const [state, action, pending] = useActionState(setConsent, initial);

  return (
    <div className={styles.wrap}>
      <ul className={styles.list}>
        {team.map((member) => {
          const sharing = member.consent_at != null;
          return (
            <li key={member.clinician_id} className={styles.card}>
              <span className={styles.avatar} aria-hidden="true">
                {initials(member.full_name)}
              </span>
              <div className={styles.info}>
                <span className={styles.name}>{member.full_name}</span>
                <span className={styles.discipline}>
                  {member.discipline ?? member.relationship ?? "Your team"}
                </span>
                <span className={sharing ? styles.sharingOn : styles.sharingOff}>
                  {sharing ? "Following your progress" : "Sharing paused"}
                </span>
              </div>
              <form action={action}>
                <input type="hidden" name="clinicianId" value={member.clinician_id} />
                <input type="hidden" name="grant" value={sharing ? "0" : "1"} />
                <button
                  className={sharing ? styles.pauseBtn : styles.resumeBtn}
                  type="submit"
                  disabled={pending}
                >
                  {sharing ? "Pause sharing" : "Resume sharing"}
                </button>
              </form>
            </li>
          );
        })}
      </ul>

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p className={styles.success}>{state.success}</p> : null}

      <p className={styles.note}>
        You are in control. Pausing takes effect immediately and can be resumed whenever you like.
        Your data stays within your community; it is never shared beyond the people above.
      </p>
    </div>
  );
}
