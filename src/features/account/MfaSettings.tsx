"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { recordMfaEvent } from "./actions";
import styles from "./account.module.css";

type Enrolment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

/**
 * Two-step verification (TOTP) for clinical accounts. Enrolment runs entirely
 * in the browser against Supabase Auth: scan the QR code (or type the secret)
 * into an authenticator app, then confirm with a six digit code. Once
 * verified, signing in asks for a code as the second step.
 */
export function MfaSettings() {
  const [loading, setLoading] = useState(true);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp.find((f) => f.status === "verified");
    setVerifiedFactorId(verified?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startEnrolment = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    const supabase = createClient();
    // A previous unfinished attempt leaves an unverified factor behind; clear
    // it so enrol does not fail on the duplicate friendly name.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const factor of existing?.totp ?? []) {
      if (factor.status !== "verified") {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }
    const { data, error: enrolError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator app",
    });
    if (enrolError || !data) {
      setError("Could not start the set-up. Try again.");
      setBusy(false);
      return;
    }
    setEnrolment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    setBusy(false);
  };

  const confirmEnrolment = async () => {
    if (!enrolment || code.trim().length < 6) {
      setError("Enter the six digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: enrolment.factorId,
    });
    if (challengeError || !challenge) {
      setError("Could not verify the code. Try again.");
      setBusy(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrolment.factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) {
      setError("That code was not recognised. Check your authenticator app and try again.");
      setBusy(false);
      return;
    }
    await recordMfaEvent("enrolled");
    setEnrolment(null);
    setCode("");
    setSuccess("Two-step verification is on. From now on, signing in asks for a code.");
    setBusy(false);
    await refresh();
  };

  const removeFactor = async () => {
    if (!verifiedFactorId) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const supabase = createClient();
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: verifiedFactorId,
    });
    if (unenrollError) {
      setError(
        "Could not turn it off. Sign out, sign back in with a code, and try again from a fresh session.",
      );
      setBusy(false);
      return;
    }
    await recordMfaEvent("unenrolled");
    setSuccess("Two-step verification is off.");
    setBusy(false);
    await refresh();
  };

  return (
    <section className={styles.form} aria-label="Two-step verification">
      <h2 className={styles.formTitle}>Two-step verification</h2>
      <p className={styles.formNote}>
        Clinical accounts handle special-category health data. With two-step verification on,
        signing in asks for a six digit code from your authenticator app.
      </p>

      {loading ? <p className={styles.formNote}>Checking your settings…</p> : null}

      {!loading && verifiedFactorId && !enrolment ? (
        <>
          <p className={styles.mfaOn}>On: a code is required at sign-in.</p>
          <button
            className={styles.withdrawBtn}
            type="button"
            onClick={removeFactor}
            disabled={busy}
          >
            {busy ? "Working…" : "Turn off"}
          </button>
        </>
      ) : null}

      {!loading && !verifiedFactorId && !enrolment ? (
        <button className={styles.submit} type="button" onClick={startEnrolment} disabled={busy}>
          {busy ? "Preparing…" : "Set up two-step verification"}
        </button>
      ) : null}

      {enrolment ? (
        <div className={styles.mfaEnrol}>
          <p className={styles.formNote}>
            Scan this QR code with an authenticator app (for example Google Authenticator, 1Password
            or Authy), then enter the six digit code it shows.
          </p>
          {/* Supabase returns the QR as an SVG string; a data URI is the only
              way to show it and next/image cannot optimise it further. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.mfaQr}
            src={`data:image/svg+xml;utf8,${encodeURIComponent(enrolment.qrCode)}`}
            alt="QR code for your authenticator app"
            width={176}
            height={176}
          />
          <p className={styles.mfaSecret}>
            Cannot scan? Enter this key by hand: <code>{enrolment.secret}</code>
          </p>
          <label className={styles.field}>
            <span className={styles.label}>Six digit code</span>
            <input
              className={styles.input}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
            />
          </label>
          <button className={styles.submit} type="button" onClick={confirmEnrolment} disabled={busy}>
            {busy ? "Confirming…" : "Confirm and turn on"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {success ? <p className={styles.success}>{success}</p> : null}
    </section>
  );
}
