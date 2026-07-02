import styles from "./status-pill.module.css";

/**
 * Status is never colour alone: every pill pairs colour + dot + text label
 * (WCAG 2.2 AA). `flag` is CONSULTANT-ONLY — the client surface passes `focus`
 * instead, which renders in watch (amber) tones with supportive wording.
 */
export type PillStatus = "on_track" | "watch" | "flag" | "focus";

const LABELS: Record<PillStatus, string> = {
  on_track: "On track",
  watch: "Watch",
  flag: "Flag",
  focus: "This week's focus",
};

const CLASSES: Record<PillStatus, string> = {
  on_track: styles.onTrack ?? "",
  watch: styles.watch ?? "",
  flag: styles.flag ?? "",
  focus: styles.watch ?? "",
};

export function StatusPill({ status, label }: { status: PillStatus; label?: string }) {
  return (
    <span className={`${styles.pill} ${CLASSES[status]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {label ?? LABELS[status]}
    </span>
  );
}
