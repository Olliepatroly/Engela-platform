import { Skel } from "./Skel";
import styles from "./client-shell.module.css";

/** Home skeleton: hero ring + three collapsed pillar rows. */
export default function Loading() {
  return (
    <div className={styles.skelStack} role="status" aria-label="Loading your week">
      <span className="srOnly">Loading your week</span>
      <div className={`${styles.skelCard} ${styles.skelCardLg}`}>
        <div className={styles.skelStack} style={{ alignItems: "center" }}>
          <Skel h="1.75rem" w="55%" r="0.5rem" />
          <Skel h="10rem" w="10rem" r="50%" />
          <Skel h="2.5rem" w="80%" r="0.5rem" />
        </div>
      </div>
      <Skel h="4.75rem" />
      <Skel h="4.75rem" />
      <Skel h="4.75rem" />
    </div>
  );
}
