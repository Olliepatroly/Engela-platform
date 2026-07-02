"use client";

import { useState, type FormEvent } from "react";
import styles from "./create-account.module.css";

type Path = "team" | "client";

/**
 * Two ways in, both invite-only: clinical team members are set up by the
 * rehab lead; clients are invited by their community. This is the request
 * foundation. Requests are not sent anywhere yet; invites remain the only
 * way an account is created.
 */
export function CreateAccountOptions() {
  const [path, setPath] = useState<Path | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const choose = (next: Path) => {
    setPath(next);
    setSubmitted(false);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.options}>
        <button
          type="button"
          className={`${styles.option} ${path === "team" ? styles.optionActive : ""}`}
          onClick={() => choose("team")}
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
          onClick={() => choose("client")}
        >
          <span className={styles.optionTitle}>I am starting my programme</span>
          <span className={styles.optionText}>
            Clients are invited personally by their community once the programme begins.
          </span>
        </button>
      </div>

      {path != null && !submitted ? (
        <form className={styles.form} onSubmit={onSubmit}>
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
          <button className={styles.submit} type="submit">
            Request an invite
          </button>
          <p className={styles.caption}>
            Access is by invitation only. Nobody can self-register into the platform.
          </p>
        </form>
      ) : null}

      {submitted ? (
        <p className={styles.confirmation}>
          Thank you. {path === "team" ? "The rehab lead" : "Your community"} will be in touch with a
          personal invitation. In this demo, requests are not yet sent anywhere.
        </p>
      ) : null}
    </div>
  );
}
