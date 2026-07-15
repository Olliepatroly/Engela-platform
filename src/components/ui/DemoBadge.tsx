import styles from "./demo-badge.module.css";

/**
 * "Demo" pill shown next to the Engela Health wordmark on every surface, so it
 * is unmistakable that this is a demonstration/staging environment under active
 * development, not a live application holding real patient data.
 */
export function DemoBadge() {
  return (
    <span
      className={styles.badge}
      title="Demo environment, under development. Not for live patient data."
    >
      Demo
    </span>
  );
}
