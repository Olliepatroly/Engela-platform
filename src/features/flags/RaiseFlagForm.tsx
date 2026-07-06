"use client";

import { useActionState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { raiseClinicianFlag, type FlagActionState } from "./actions";
import type { CareClient } from "./data";
import styles from "./flags.module.css";

const initial: FlagActionState = { error: null, success: null };

/**
 * The SBAR prompt: raising a flag REQUIRES completing all four SBAR sections.
 * Background arrives prefilled from the client's clinical record and health
 * profile (server-composed for the selected client); the clinician reviews and
 * extends it. Selecting a client re-navigates so the prefill is recomputed
 * server-side, never fetched from the browser.
 */
export function RaiseFlagForm({
  clients,
  selectedClientId,
  backgroundPrefill,
  sessionId,
}: {
  clients: CareClient[];
  selectedClientId: string | null;
  backgroundPrefill: string;
  sessionId: string | null;
}) {
  const [state, action, pending] = useActionState(raiseClinicianFlag, initial);
  const router = useRouter();
  const searchParams = useSearchParams();

  const pickClient = (id: string) => {
    const params = new URLSearchParams(searchParams);
    if (id) params.set("client", id);
    else params.delete("client");
    router.replace(`/console/flags?${params.toString()}`);
  };

  return (
    <form action={action} className={styles.formCard}>
      <h2 className={styles.formTitle}>Raise a clinical flag</h2>
      <p className={styles.formIntro}>
        A flag is a screening event for the team. Every clinician-raised flag carries a full SBAR:
        the situation, the client&rsquo;s background, your assessment (questions asked, readings
        and observations), and your recommendation.
      </p>

      <label className={styles.fieldLabel}>
        Client
        <select
          className={styles.select}
          name="clientId"
          value={selectedClientId ?? ""}
          onChange={(e) => pickClient(e.target.value)}
          required
        >
          <option value="" disabled>
            Choose a client on your care team
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.mrn})
            </option>
          ))}
        </select>
      </label>

      {sessionId ? <input type="hidden" name="sessionId" value={sessionId} /> : null}

      <fieldset className={styles.tierRow}>
        <legend className={styles.fieldLabel}>Concern tier</legend>
        <label className={styles.tierChoice}>
          <input type="radio" name="tier" value="minor" defaultChecked required />
          Minor concern: worth the team&rsquo;s attention
        </label>
        <label className={styles.tierChoice}>
          <input type="radio" name="tier" value="major" required />
          Major concern: needs prompt clinical review
        </label>
      </fieldset>

      <label className={styles.fieldLabel}>
        Headline
        <input
          className={styles.input}
          name="summary"
          maxLength={200}
          placeholder="One line the team sees first"
          required
        />
      </label>

      <label className={styles.fieldLabel}>
        Situation
        <span className={styles.fieldHint}>What happened, when, and during what activity.</span>
        <textarea className={styles.textarea} name="situation" rows={3} maxLength={2000} required />
      </label>

      <label className={styles.fieldLabel}>
        Background
        <span className={styles.fieldHint}>
          Prefilled from the client&rsquo;s record and health profile. Review and add anything
          relevant.
        </span>
        <textarea
          className={styles.textarea}
          name="background"
          rows={5}
          maxLength={4000}
          key={selectedClientId ?? "none"}
          defaultValue={backgroundPrefill}
          required
        />
      </label>

      <label className={styles.fieldLabel}>
        Assessment
        <span className={styles.fieldHint}>
          Questions asked, clinical readings and observations that back this up.
        </span>
        <textarea
          className={styles.textarea}
          name="assessment"
          rows={4}
          maxLength={4000}
          required
        />
      </label>

      <label className={styles.fieldLabel}>
        Recommendation
        <span className={styles.fieldHint}>What you recommended or asked for.</span>
        <textarea
          className={styles.textarea}
          name="recommendation"
          rows={3}
          maxLength={2000}
          required
        />
      </label>

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p className={styles.success}>{state.success}</p> : null}

      <button className={styles.submit} type="submit" disabled={pending || !selectedClientId}>
        {pending ? "Raising..." : "Raise flag with SBAR"}
      </button>
    </form>
  );
}
