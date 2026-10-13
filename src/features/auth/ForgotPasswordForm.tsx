"use client";

import { useActionState } from "react";
import { requestPasswordReset, type ResetRequestState } from "./reset-actions";
import styles from "./signin-form.module.css";

const initialState: ResetRequestState = { error: null, sent: false };

/**
 * Asks for the account email and sends a reset link to it. The confirmation
 * reads the same whether or not the email has an account.
 */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  if (state.sent) {
    return (
      <p className={styles.notice} role="status">
        If that email belongs to an Engela Health account, a link to reset your password is on its
        way. It is valid for one hour. Check your spam folder if it has not arrived in a few
        minutes.
      </p>
    );
  }

  return (
    <form className={styles.form} action={formAction} noValidate>
      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input
          className={styles.input}
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          autoFocus
        />
      </label>

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
