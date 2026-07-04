import { Skel } from "../Skel";
import styles from "../client-shell.module.css";

/** Account skeleton: title + the name and password forms. */
export default function Loading() {
  return (
    <div className={styles.skelStack} role="status" aria-label="Loading your account">
      <span className="srOnly">Loading your account</span>
      <Skel h="2rem" w="55%" r="0.5rem" />
      <Skel h="1rem" w="80%" r="0.5rem" />
      <Skel h="3rem" />
      <Skel h="6rem" />
      <Skel h="6rem" />
    </div>
  );
}
