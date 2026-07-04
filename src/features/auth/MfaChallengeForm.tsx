"use client";

import { useActionState } from "react";
import { verifyMfaCode, type SignInState } from "./actions";
import styles from "./signin-form.module.css";

const initialState: SignInState = { error: null, mfaRequired: true };

/**
 * Second sign-in step: the six digit code from the authenticator app.
 * Rendered by the sign-in form after the password step, and by /signin/mfa
 * when the middleware sends a signed-in clinician back to finish stepping up.
 */
export function MfaChallengeForm() {
  const [state, formAction, pending] = useActionState(verifyMfaCode, initialState);

  return (
    <form className={styles.form} action={formAction} noValidate>
      <label className={styles.field}>
        <span className={styles.label}>Six digit code</span>
        <input
          className={styles.input}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          name="code"
          required
          placeholder="123456"
          autoFocus
        />
      </label>

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Checking…" : "Verify and sign in"}
      </button>
    </form>
  );
}
