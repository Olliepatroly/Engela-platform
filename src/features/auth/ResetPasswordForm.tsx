"use client";

import { useActionState } from "react";
import { resetPassword, type ResetState } from "./reset-actions";
import styles from "./signin-form.module.css";

const initialState: ResetState = { error: null };

/** Choose a new password from the emailed link. On success the action redirects to sign-in. */
export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, initialState);

  return (
    <form className={styles.form} action={formAction} noValidate>
      <input type="hidden" name="token" value={token} />

      <label className={styles.field}>
        <span className={styles.label}>New password</span>
        <input
          className={styles.input}
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={10}
          required
          placeholder="At least 10 characters"
          autoFocus
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Confirm new password</span>
        <input
          className={styles.input}
          type="password"
          name="confirm"
          autoComplete="new-password"
          minLength={10}
          required
          placeholder="Type it again"
        />
      </label>

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
