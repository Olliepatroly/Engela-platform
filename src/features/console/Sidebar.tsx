"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EngelaMark, StatusPill } from "@/components/ui";
import { signOut } from "@/features/auth";
import type { RosterEntry } from "./data";
import styles from "./sidebar.module.css";

const COLLAPSE_KEY = "engela.console.sidebar.collapsed";
const MOBILE_QUERY = "(max-width: 56rem)";

function initials(name: string): string {
  return name
    .split(" ")
    .filter((part) => part && part !== "Dr")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Permanent left navigation for the console. Collapses to a slim rail of
 * initials and icons; the choice persists per browser.
 */
export function Sidebar({
  roster,
  viewerName,
  selectedId,
  activeNav,
  rosterBasePath = "/console",
}: {
  roster: RosterEntry[];
  viewerName: string;
  selectedId?: string;
  activeNav: "review" | "programs" | "search" | "account";
  /** Where a roster click lands: the review (default) or the programmes page. */
  rosterBasePath?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");

    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      window.localStorage.setItem(COLLAPSE_KEY, prev ? "0" : "1");
      return !prev;
    });
  };

  // The collapse toggle is a desktop affordance: below the breakpoint the
  // rail is always a full horizontal top bar, whatever the stored preference.
  const effectiveCollapsed = collapsed && !isMobile;

  return (
    <div className={`${styles.holder} ${effectiveCollapsed ? styles.holderCollapsed : ""}`}>
      <aside className={`${styles.rail} ${effectiveCollapsed ? styles.railCollapsed : ""}`}>
      <div className={styles.top}>
        {!effectiveCollapsed ? (
          <p className={styles.wordmark}>
            <EngelaMark className={styles.markIcon} size={1.05} />
            <span className={styles.wordmarkSerif}>Engela</span>
            <span className={styles.wordmarkSans}>HEALTH</span>
          </p>
        ) : (
          <p className={styles.wordmarkMini}>
            <EngelaMark className={styles.markIcon} size={1.05} />
          </p>
        )}
        <button
          className={styles.collapseBtn}
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <nav className={styles.nav} aria-label="Console">
        <Link
          href="/console"
          className={`${styles.navLink} ${activeNav === "review" ? styles.navLinkActive : ""}`}
        >
          <span className={styles.navIcon} aria-hidden="true">
            ▦
          </span>
          {!effectiveCollapsed ? <span>Weekly review</span> : null}
        </Link>
        <Link
          href="/console/programs"
          className={`${styles.navLink} ${activeNav === "programs" ? styles.navLinkActive : ""}`}
        >
          <span className={styles.navIcon} aria-hidden="true">
            ▷
          </span>
          {!effectiveCollapsed ? <span>Programmes</span> : null}
        </Link>
        <Link
          href="/console/search"
          className={`${styles.navLink} ${activeNav === "search" ? styles.navLinkActive : ""}`}
        >
          <span className={styles.navIcon} aria-hidden="true">
            ⌕
          </span>
          {!effectiveCollapsed ? <span>Find people</span> : null}
        </Link>
        <Link
          href="/console/account"
          className={`${styles.navLink} ${activeNav === "account" ? styles.navLinkActive : ""}`}
        >
          <span className={styles.navIcon} aria-hidden="true">
            ◍
          </span>
          {!effectiveCollapsed ? <span>My account</span> : null}
        </Link>
      </nav>

      <p className={styles.railHeading}>{effectiveCollapsed ? "•••" : "This week"}</p>
      <nav className={styles.rosterList} aria-label="Patients">
        {roster.map((entry) => {
          const selected = entry.clientId === selectedId;
          return (
            <Link
              key={entry.clientId}
              href={`${rosterBasePath}?patient=${entry.clientId}`}
              className={`${styles.rosterRow} ${selected ? styles.rosterRowSelected : ""}`}
              aria-current={selected ? "page" : undefined}
              title={`${entry.fullName} · ${entry.mrn}`}
            >
              {effectiveCollapsed ? (
                <span className={styles.avatar}>
                  {entry.reviewStatus === "flag" ? (
                    <span className={styles.flagDot} aria-label="Flagged" />
                  ) : null}
                  {initials(entry.fullName)}
                </span>
              ) : (
                <>
                  <span className={styles.rosterName}>
                    {entry.reviewStatus === "flag" ? (
                      <span className={styles.flagDot} aria-label="Flagged" />
                    ) : null}
                    {entry.fullName}
                  </span>
                  <span className={styles.rosterMeta}>
                    {entry.mrn}
                    {entry.week != null ? ` · Week ${entry.week}` : ""}
                  </span>
                  {entry.reviewStatus ? (
                    <StatusPill status={entry.reviewStatus} />
                  ) : (
                    <span className={styles.rosterNoReview}>No review yet</span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        {!effectiveCollapsed ? <p className={styles.viewer}>{viewerName}</p> : null}
        <form action={signOut}>
          <button className={styles.signOut} type="submit" title="Sign out">
            {effectiveCollapsed ? "⎋" : "Sign out"}
          </button>
        </form>
      </div>
      </aside>
    </div>
  );
}
