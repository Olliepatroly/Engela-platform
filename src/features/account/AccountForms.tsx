"use client";

import { useActionState } from "react";
import {
  updateName,
  updateClinicianDetails,
  changePassword,
  type AccountState,
} from "./actions";
import styles from "./account.module.css";

const initial: AccountState = { error: null, success: null };

function Feedback({ state }: { state: AccountState }) {
  if (state.error) {
    return (
      <p className={styles.error} role="alert">
        {state.error}
      </p>
    );
  }
  if (state.success) return <p className={styles.success}>{state.success}</p>;
  return null;
}

export function NameForm({ fullName }: { fullName: string }) {
  const [state, action, pending] = useActionState(updateName, initial);
  return (
    <form className={styles.form} action={action}>
      <h2 className={styles.formTitle}>Your name</h2>
      <p className={styles.formNote}>Shown to your care team and on reviews.</p>
      <label className={styles.field}>
        <span className={styles.label}>Full name</span>
        <input className={styles.input} name="fullName" defaultValue={fullName} required />
      </label>
      <Feedback state={state} />
      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save name"}
      </button>
    </form>
  );
}

export function ClinicianForm({
  discipline,
  registrationNo,
}: {
  discipline: string;
  registrationNo: string;
}) {
  const [state, action, pending] = useActionState(updateClinicianDetails, initial);
  return (
    <form className={styles.form} action={action}>
      <h2 className={styles.formTitle}>Professional details</h2>
      <p className={styles.formNote}>Visible to colleagues on shared care teams.</p>
      <label className={styles.field}>
        <span className={styles.label}>Discipline</span>
        <input
          className={styles.input}
          name="discipline"
          defaultValue={discipline}
          placeholder="e.g. Clinical Exercise Physiologist"
          required
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Registration number</span>
        <input
          className={styles.input}
          name="registrationNo"
          defaultValue={registrationNo}
          placeholder="e.g. GMC 1234567"
        />
      </label>
      <Feedback state={state} />
      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initial);
  return (
    <form className={styles.form} action={action}>
      <h2 className={styles.formTitle}>Password</h2>
      <p className={styles.formNote}>At least 10 characters.</p>
      <label className={styles.field}>
        <span className={styles.label}>New password</span>
        <input
          className={styles.input}
          type="password"
          name="password"
          autoComplete="new-password"
          required
        />
      </label>
      <Feedback state={state} />
      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}

export type CareTeamMember = {
  clinician_id: string;
  full_name: string;
  discipline: string | null;
  relationship: string | null;
  consent_at: string | null;
};
