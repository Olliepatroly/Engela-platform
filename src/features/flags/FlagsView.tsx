"use client";

import { useActionState } from "react";
import { StatusPill } from "@/components/ui";
import { markFlagReviewed, type FlagActionState } from "./actions";
import type { FlagVM } from "./data";
import styles from "./flags.module.css";

const initial: FlagActionState = { error: null, success: null };

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReviewButton({ flagId }: { flagId: string }) {
  const [state, action, pending] = useActionState(markFlagReviewed, initial);
  return (
    <form action={action} className={styles.reviewRow}>
      <input type="hidden" name="flagId" value={flagId} />
      {state.error ? <span className={styles.error}>{state.error}</span> : null}
      <button className={styles.reviewBtn} type="submit" disabled={pending}>
        {pending ? "Saving..." : "Mark reviewed"}
      </button>
    </form>
  );
}

/**
 * The clinical flags queue: newest first, tier always shown as colour + dot +
 * text. Clinician flags show the full SBAR; client concerns show the voice
 * note (signed URL playback) or typed description. RLS scopes the list to the
 * viewer's consented care team.
 */
export function FlagsView({ flags }: { flags: FlagVM[] }) {
  if (flags.length === 0) {
    return <p className={styles.emptyNote}>No flags for your clients. That is a good week.</p>;
  }

  return (
    <ul className={styles.list}>
      {flags.map((flag) => (
        <li
          key={flag.id}
          className={`${styles.flagCard} ${
            flag.tier === "major" ? styles.flagCardMajor : styles.flagCardMinor
          }`}
        >
          <div className={styles.flagTop}>
            <span className={styles.flagWho}>
              {flag.clientName} <span className={styles.flagMeta}>{flag.mrn}</span>
            </span>
            <StatusPill
              status={flag.tier === "major" ? "flag" : "watch"}
              label={flag.tier === "major" ? "Major concern" : "Minor concern"}
            />
          </div>
          <p className={styles.flagMeta}>
            Raised by {flag.raisedByName}
            {flag.raisedRole === "client" ? " (client, self-conducted session)" : ""} ·{" "}
            {formatWhen(flag.createdAt)}
          </p>

          {flag.summary ? <p className={styles.flagSummary}>{flag.summary}</p> : null}

          {flag.sbar ? (
            <div className={styles.sbarGrid}>
              <div className={styles.sbarBlock}>
                <span className={styles.sbarLabel}>Situation</span>
                <p className={styles.sbarText}>{flag.sbar.situation}</p>
              </div>
              <div className={styles.sbarBlock}>
                <span className={styles.sbarLabel}>Background</span>
                <p className={styles.sbarText}>{flag.sbar.background}</p>
              </div>
              <div className={styles.sbarBlock}>
                <span className={styles.sbarLabel}>Assessment</span>
                <p className={styles.sbarText}>{flag.sbar.assessment}</p>
              </div>
              <div className={styles.sbarBlock}>
                <span className={styles.sbarLabel}>Recommendation</span>
                <p className={styles.sbarText}>{flag.sbar.recommendation}</p>
              </div>
            </div>
          ) : null}

          {flag.voiceUrl ? (
            <div>
              <span className={styles.sbarLabel}>Voice note from the client</span>
              <audio className={styles.voice} controls preload="none" src={flag.voiceUrl} />
            </div>
          ) : null}

          {flag.transcript ? (
            <div className={styles.sbarBlock}>
              <span className={styles.sbarLabel}>Client&rsquo;s description</span>
              <p className={styles.sbarText}>{flag.transcript}</p>
            </div>
          ) : null}

          {flag.status === "reviewed" ? (
            <p className={styles.reviewedNote}>
              Reviewed by {flag.reviewedByName ?? "the team"}
              {flag.reviewedAt ? ` · ${formatWhen(flag.reviewedAt)}` : ""}
            </p>
          ) : (
            <ReviewButton flagId={flag.id} />
          )}
        </li>
      ))}
    </ul>
  );
}
