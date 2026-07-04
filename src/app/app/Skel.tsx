import type { CSSProperties } from "react";
import styles from "./client-shell.module.css";

/**
 * A single shimmering placeholder block used by the client-app route skeletons.
 * Purely decorative (aria-hidden); each loading.tsx wraps its skeletons in a
 * role="status" region with visually-hidden "Loading" text for assistive tech.
 */
export function Skel({
  h,
  w = "100%",
  r = "var(--radius-client)",
}: {
  h: string;
  w?: string;
  r?: string;
}) {
  const style: CSSProperties = { height: h, width: w, borderRadius: r };
  return <div className={styles.skel} style={style} aria-hidden="true" />;
}
