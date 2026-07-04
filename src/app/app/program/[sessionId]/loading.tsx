import { Skel } from "../../Skel";
import styles from "../../client-shell.module.css";

/** Session-detail skeleton: back-link + the session card and its parts. */
export default function Loading() {
  return (
    <div className={styles.skelStack} role="status" aria-label="Loading your session">
      <span className="srOnly">Loading your session</span>
      <Skel h="1rem" w="45%" r="0.5rem" />
      <Skel h="9rem" />
      <Skel h="6rem" />
    </div>
  );
}
