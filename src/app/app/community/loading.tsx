import { Skel } from "../Skel";
import styles from "../client-shell.module.css";

/** Community skeleton: title + a few team cards. */
export default function Loading() {
  return (
    <div className={styles.skelStack} role="status" aria-label="Loading the community">
      <span className="srOnly">Loading the community</span>
      <Skel h="2rem" w="55%" r="0.5rem" />
      <Skel h="1rem" w="88%" r="0.5rem" />
      <Skel h="4.75rem" />
      <Skel h="4.75rem" />
      <Skel h="4.75rem" />
    </div>
  );
}
