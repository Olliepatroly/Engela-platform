"use client";

import { useActionState } from "react";
import { acceptInvite, type AcceptState } from "./actions";
import styles from "./accept.module.css";

const initial: AcceptState = { error: null };

/**
 * Acceptance form for a signed invite. The email and role come from the
 * invitation and cannot be changed here; the invitee sets their name and a
 * password, and is signed straight in.
 */
export function AcceptInviteForm({
  token,
  fullName,
  email,
  isClient,
}: {
  token: string;
  fullName: string;
  email: string;
  isClient: boolean;
}) {
  const [state, action, pending] = useActionState(acceptInvite, initial);

  return (
    <form className={styles.form} action={action} noValidate>
      <input type="hidden" name="token" value={token} />

      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input className={`${styles.input} ${styles.readonly}`} value={email} readOnly />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Full name</span>
        <input
          className={styles.input}
          name="fullName"
          defaultValue={fullName}
          autoComplete="name"
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Choose a password</span>
        <input
          className={styles.input}
          type="password"
          name="password"
          autoComplete="new-password"
          required
          placeholder="At least 10 characters"
        />
      </label>

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Setting up your account…" : "Accept and sign in"}
      </button>
      {isClient ? (
        <p className={styles.caption}>
          By accepting you agree that your rehabilitation data is recorded on the platform and
          shared with the person who invited you. You control sharing per clinician in The
          community, and you can pause it at any time.
        </p>
      ) : (
        <p className={styles.caption}>
          Clinical accounts handle special-category health data. Set up two-step verification in My
          account once you are in.
        </p>
      )}
    </form>
  );
}
