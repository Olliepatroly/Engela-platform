"use client";

import { useActionState, useState } from "react";
import styles from "./create-account.module.css";

type Path = "team" | "client";

// Mirrors the invites feature's RequestState; declared locally so auth does
// not import across features (the page passes the server action in).
export type AccountRequestState = { error: string | null; success: string | null };

const initial: AccountRequestState = { error: null, success: null };

/**
 * Two ways in, both invite-only: clinical team members are set up by the
 * rehab lead; clients are invited by their community. Submitting files a
 * request on the clinical team's invitations screen; invites remain the only
 * way an account is created.
 */
export function CreateAccountOptions({
  requestAction,
}: {
  requestAction: (state: AccountRequestState, formData: FormData) => Promise<AccountRequestState>;
}) {
  const [path, setPath] = useState<Path | null>(null);
  const [state, action, pending] = useActionState(requestAction, initial);

  return (
    <div className={styles.wrap}>
      <div className={styles.options}>
        <button
          type="button"
          className={`${styles.option} ${path === "team" ? styles.optionActive : ""}`}
          onClick={() => setPath("team")}
        >
          <span className={styles.optionTitle}>I am part of the clinical team</span>
          <span className={styles.optionText}>
            Consultants, physiotherapists, exercise physiologists and nurses join through the rehab
            lead.
          </span>
        </button>
        <button
          type="button"
          className={`${styles.option} ${path === "client" ? styles.optionActive : ""}`}
          onClick={() => setPath("client")}
        >
          <span className={styles.optionTitle}>I am starting my programme</span>
          <span className={styles.optionText}>
            Clients are invited personally by their community once the programme begins.
          </span>
        </button>
      </div>

      {path != null && !state.success ? (
        <form className={styles.form} action={action}>
          <input type="hidden" name="path" value={path} />
          <label className={styles.field}>
            <span className={styles.label}>Full name</span>
            <input className={styles.input} name="fullName" required placeholder="Your name" />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input
              className={styles.input}
              type="email"
              name="email"
              required
              placeholder="you@example.com"
            />
          </label>
          {path === "team" ? (
            <label className={styles.field}>
              <span className={styles.label}>Professional role</span>
              <select className={styles.input} name="role" required defaultValue="">
                <option value="" disabled>
                  Choose your role
                </option>
                <option>Consultant</option>
                <option>Physiotherapist</option>
                <option>Clinical exercise physiologist</option>
                <option>Specialist nurse</option>
              </select>
            </label>
          ) : null}
          {state.error ? (
            <p className={styles.error} role="alert">
              {state.error}
            </p>
          ) : null}
          <button className={styles.submit} type="submit" disabled={pending}>
            {pending ? "Sending…" : "Request an invite"}
          </button>
          <p className={styles.caption}>
            Access is by invitation only. Nobody can self-register into the platform.
          </p>
        </form>
      ) : null}

      {state.success ? <p className={styles.confirmation}>{state.success}</p> : null}
    </div>
  );
}
