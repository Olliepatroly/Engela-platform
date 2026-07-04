import { Skel } from "../Skel";
import styles from "../client-shell.module.css";

/** Programme skeleton: title + the next session and a couple of list rows. */
export default function Loading() {
  return (
    <div className={styles.skelStack} role="status" aria-label="Loading your programme">
      <span className="srOnly">Loading your programme</span>
      <Skel h="2rem" w="65%" r="0.5rem" />
      <Skel h="1rem" w="90%" r="0.5rem" />
      <Skel h="7.5rem" />
      <Skel h="5rem" />
      <Skel h="5rem" />
    </div>
  );
}
