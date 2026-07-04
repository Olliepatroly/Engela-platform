"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./client-shell.module.css";

type Tab = { href: string; label: string };

/* The four client destinations that ship now (Progress/Actions arrive later). */
const TABS: Tab[] = [
  { href: "/app", label: "Home" },
  { href: "/app/program", label: "Programme" },
  { href: "/app/community", label: "Community" },
  { href: "/app/account", label: "Account" },
];

/**
 * Fixed bottom tab bar for the client app, shared across every /app route via
 * the client-segment layout. The active tab is navy text plus a small amber
 * dot (status is never colour alone) and carries aria-current="page"; inactive
 * tabs are muted grey. Tokens only.
 */
export function ClientTabBar() {
  const pathname = usePathname();

  return (
    <nav className={styles.tabBar} aria-label="Your app">
      {TABS.map((tab) => {
        // Home matches only exactly; deeper tabs match their sub-routes too
        // (e.g. a session detail keeps Programme active).
        const active =
          tab.href === "/app" ? pathname === "/app" : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={styles.tab}
            data-active={active ? "true" : undefined}
            aria-current={active ? "page" : undefined}
          >
            <span className={styles.tabDot} aria-hidden="true" />
            <span className={styles.tabLabel}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
