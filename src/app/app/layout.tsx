import type { ReactNode } from "react";
import { DemoBadge, EngelaMark } from "@/components/ui";
import { signOut } from "@/features/auth";
import { ClientTabBar } from "./ClientTabBar";
import styles from "./client-shell.module.css";

/**
 * Client-segment shell: a shared top header (wordmark + Sign out) and a fixed
 * bottom tab bar around every /app route. Section navigation now lives only in
 * the bottom bar; individual pages render just their own content. Middleware
 * gates this segment to clients; RLS remains the real security boundary.
 */
export default function ClientAppLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <p className={styles.wordmark}>
          <EngelaMark className={styles.mark} size={1.1} />
          <span className={styles.wordmarkSerif}>Engela</span>
          <span className={styles.wordmarkSans}>HEALTH</span>
          <DemoBadge />
        </p>
        <form action={signOut}>
          <button className={styles.signOut} type="submit">
            Sign out
          </button>
        </form>
      </header>

      <main className={styles.content}>{children}</main>

      <ClientTabBar />
    </div>
  );
}
