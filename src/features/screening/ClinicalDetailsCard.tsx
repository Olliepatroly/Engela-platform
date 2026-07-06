import Link from "next/link";
import type { HealthProfileVM } from "./data";
import styles from "./screening.module.css";

function labelFor(key: string): string {
  const label = key.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * "Your clinical details" on the account page: the PAR-Q status and the
 * details the care team keeps with the account. Read-only for the client;
 * the team maintains the details from the console.
 */
export function ClinicalDetailsCard({ profile }: { profile: HealthProfileVM }) {
  const detailEntries = Object.entries(profile.details);

  return (
    <section className={styles.detailsCard} aria-label="Your clinical details">
      <h2 className={styles.detailsTitle}>Your clinical details</h2>

      <div className={styles.parqRow}>
        {profile.parqCompleted ? (
          <p className={styles.parqDone}>
            Readiness screening (PAR-Q) completed
            {profile.parqCompletedAt
              ? ` on ${new Date(profile.parqCompletedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`
              : ""}
            .{" "}
            <Link className={styles.parqLink} href="/app/parq">
              Update your answers
            </Link>
          </p>
        ) : (
          <p className={styles.parqPending}>
            Your readiness screening (PAR-Q) is not done yet. It takes about two minutes and helps
            your team keep your programme safe.{" "}
            <Link className={styles.parqLink} href="/app/parq">
              Complete it now
            </Link>
          </p>
        )}
      </div>

      {detailEntries.length > 0 ? (
        <dl className={styles.detailsList}>
          {detailEntries.map(([key, value]) => (
            <div key={key} className={styles.detailsRow}>
              <dt className={styles.detailsKey}>{labelFor(key)}</dt>
              <dd className={styles.detailsValue}>{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className={styles.note}>
          Your team will add clinical details here as your programme goes on. If anything changes,
          tell them and they will keep it up to date.
        </p>
      )}
    </section>
  );
}
