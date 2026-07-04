"use client";

import { useMemo, useState } from "react";
import type { AuditEntryVM } from "./data";
import { logAuditExport } from "./audit-actions";
import styles from "./audit.module.css";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function formatDayLabel(ymd: string): string {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Filters = { q: string; who: string; client: string; from: string; to: string };

const EMPTY: Filters = { q: "", who: "", client: "", from: "", to: "" };

/**
 * The audit trail with search and filters. Rows arrive already scoped by RLS
 * to what the viewer may see (admins: everything; others: own actions plus
 * consented care-team clients), so nothing sensitive is filtered only in the
 * browser. Filtering by time, who, client and free text narrows that set, and
 * the current selection can be exported to PDF for a subject-access request or
 * a governance review.
 */
export function AuditTrailView({
  entries,
  viewerName,
}: {
  entries: AuditEntryVM[];
  viewerName: string;
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY);

  // Dropdown options are drawn from the rows the viewer can actually see, so
  // you can only filter by people and clients present in your own audit view.
  const whoOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) if (e.actorId) map.set(e.actorId, e.actorName);
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries]);

  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) if (e.clientId && e.clientName) map.set(e.clientId, e.clientName);
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const fromTs = filters.from ? new Date(`${filters.from}T00:00:00Z`).getTime() : null;
    const toTs = filters.to ? new Date(`${filters.to}T23:59:59.999Z`).getTime() : null;

    return entries.filter((e) => {
      if (filters.who && e.actorId !== filters.who) return false;
      if (filters.client && e.clientId !== filters.client) return false;
      const ts = new Date(e.at).getTime();
      if (fromTs != null && ts < fromTs) return false;
      if (toTs != null && ts > toTs) return false;
      if (q) {
        const hay = `${e.actorName} ${e.clientName ?? ""} ${e.action} ${e.detail}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, filters]);

  const hasFilters =
    filters.q !== "" || filters.who !== "" || filters.client !== "" || filters.from !== "" || filters.to !== "";

  /** Human-readable summary of the active filters, for the report and the audit log. */
  function filterSummary(): string {
    const parts: string[] = [];
    if (filters.who) parts.push(`Who: ${whoOptions.find((o) => o[0] === filters.who)?.[1] ?? ""}`);
    if (filters.client)
      parts.push(`Client: ${clientOptions.find((o) => o[0] === filters.client)?.[1] ?? ""}`);
    if (filters.from || filters.to) {
      const from = filters.from ? formatDayLabel(filters.from) : "the start";
      const to = filters.to ? formatDayLabel(filters.to) : "now";
      parts.push(`Dates: ${from} to ${to}`);
    }
    if (filters.q) parts.push(`Search: "${filters.q.trim()}"`);
    return parts.length ? parts.join(" · ") : "No filters (whole trail)";
  }

  function exportPdf() {
    if (filtered.length === 0) return;
    const root = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) =>
      root.getPropertyValue(name).trim() || fallback;
    const navy = token("--c-navy", "#001a38");
    const slate = token("--c-slate", "#2e5077");
    const line = token("--c-line", "rgba(46,80,119,0.14)");
    const secondary = token("--c-text-secondary", "#52617a");

    const summary = filterSummary();
    const generated = new Date().toLocaleString("en-GB", { timeZone: "UTC" });

    const rowsHtml = filtered
      .map(
        (e) => `<tr>
          <td class="when">${escapeHtml(formatWhen(e.at))}</td>
          <td>${escapeHtml(e.actorName)}</td>
          <td class="what">${escapeHtml(e.action)}</td>
          <td>${escapeHtml(e.clientName ?? "")}</td>
          <td class="detail">${escapeHtml(e.detail)}</td>
        </tr>`,
      )
      .join("");

    // Standalone document: colours are read from the app's own tokens above,
    // so this stays in step with the design system without hard-coding hex.
    const html = `<!doctype html><html><head><meta charset="utf-8">
      <title>Engela Health audit trail export</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
               color: ${navy}; margin: 32px; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .meta { color: ${secondary}; font-size: 12px; line-height: 1.5; margin-bottom: 4px; }
        .confidential { color: ${slate}; font-size: 11px; font-weight: 700;
                        text-transform: uppercase; letter-spacing: 0.05em; margin: 12px 0 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { text-align: left; padding: 6px 8px; border-bottom: 2px solid ${slate};
             font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: ${secondary}; }
        td { padding: 6px 8px; border-bottom: 1px solid ${line}; vertical-align: top; }
        .when { white-space: nowrap; color: ${secondary}; }
        .what { font-weight: 600; }
        .detail { color: ${secondary}; }
        tfoot td { border: none; padding-top: 16px; color: ${secondary}; font-size: 10px; }
        @media print { body { margin: 12mm; } }
      </style></head>
      <body>
        <h1>Engela Health &mdash; audit trail</h1>
        <p class="meta">Generated by ${escapeHtml(viewerName)} on ${escapeHtml(generated)} (UTC).</p>
        <p class="meta">Filters: ${escapeHtml(summary)}. ${filtered.length} record${
          filtered.length === 1 ? "" : "s"
        }.</p>
        <p class="confidential">Confidential &mdash; special-category health data. Handle under the practice information-governance policy.</p>
        <table>
          <thead><tr>
            <th>When (UTC)</th><th>Who</th><th>What</th><th>Client</th><th>Detail</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot><tr><td colspan="5">
            This export lists only events the person who generated it is permitted to see.
          </td></tr></tfoot>
        </table>
      </body></html>`;

    // Open first (inside the click gesture) so the popup is not blocked, then
    // record the export as its own governance event.
    const win = window.open("", "_blank", "width=980,height=720");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.onload = () => win.print();
      // Fallback for browsers that fire load before the handler is attached.
      setTimeout(() => win.print(), 400);
    }
    void logAuditExport({ filters: summary, rowCount: filtered.length });
  }

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.heading}>Audit trail</h1>
        <p className={styles.subhead}>
          Every audited event you are permitted to see, newest first: readings and corrections,
          goals, actions and safety flags, weekly review sign-offs, consent changes, invitations and
          two-step verification. Entries are append-only. Filter the trail and export the result to
          PDF for a governance review or a subject-access request.
        </p>
      </div>

      <div className={styles.filterBar}>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>Search</span>
          <input
            className={styles.filterInput}
            type="search"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="Name, action or detail"
          />
        </label>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>Who</span>
          <select
            className={styles.filterInput}
            value={filters.who}
            onChange={(e) => setFilters((f) => ({ ...f, who: e.target.value }))}
          >
            <option value="">Anyone</option>
            {whoOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>Client</span>
          <select
            className={styles.filterInput}
            value={filters.client}
            onChange={(e) => setFilters((f) => ({ ...f, client: e.target.value }))}
          >
            <option value="">Any client</option>
            {clientOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>From</span>
          <input
            className={styles.filterInput}
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          />
        </label>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>To</span>
          <input
            className={styles.filterInput}
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          />
        </label>
        {hasFilters ? (
          <button className={styles.clearButton} type="button" onClick={() => setFilters(EMPTY)}>
            Clear
          </button>
        ) : null}
      </div>

      <div className={styles.resultRow}>
        <span className={styles.resultCount}>
          {filtered.length} of {entries.length} {entries.length === 1 ? "event" : "events"}
        </span>
        <button
          className={styles.exportButton}
          type="button"
          onClick={exportPdf}
          disabled={filtered.length === 0}
        >
          Export to PDF
        </button>
      </div>

      <div className={styles.tableWrap}>
        {filtered.length === 0 ? (
          <p className={styles.empty}>
            {entries.length === 0 ? "No audited events yet." : "No events match these filters."}
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">When (UTC)</th>
                <th scope="col">Who</th>
                <th scope="col">What</th>
                <th scope="col">Client</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id}>
                  <td className={styles.when}>{formatWhen(entry.at)}</td>
                  <td>{entry.actorName}</td>
                  <td className={styles.action}>{entry.action}</td>
                  <td>{entry.clientName ?? ""}</td>
                  <td className={styles.detail}>{entry.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
