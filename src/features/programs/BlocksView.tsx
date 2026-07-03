import Link from "next/link";
import { BlockEditForm } from "./BuilderPanels";
import { formatSessionDate, type CalendarVM } from "./constants";
import type { BlockVM } from "./data";
import styles from "./programs.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const BLOCK_STATUS_LABELS: Record<BlockVM["status"], string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

function StatusDot({ status }: { status: "scheduled" | "completed" | "missed" }) {
  const cls =
    status === "completed"
      ? styles.dayDotCompleted
      : status === "missed"
        ? styles.dayDotMissed
        : styles.dayDotScheduled;
  return <span className={`${styles.dayDot} ${cls}`} aria-hidden="true" />;
}

/**
 * Blocks: a month calendar of every session with the active block's span
 * highlighted, and the list of blocks (editable by the CEP).
 */
export function BlocksView({
  clientId,
  calendar,
  blocks,
  canBuild,
}: {
  clientId: string;
  calendar: CalendarVM;
  blocks: BlockVM[];
  canBuild: boolean;
}) {
  const activeBlock = blocks.find((b) => b.status === "active") ?? null;

  return (
    <>
      <section className={styles.calendarCard} aria-label={`Calendar, ${calendar.label}`}>
        <header className={styles.calendarHeader}>
          <h2 className={styles.sessionListTitle}>{calendar.label}</h2>
          <div className={styles.calendarNav}>
            <Link
              className={styles.calendarNavBtn}
              href={`/console/programs/blocks?patient=${clientId}&month=${calendar.prevMonthIso}`}
              aria-label="Previous month"
            >
              ‹
            </Link>
            <Link
              className={styles.calendarNavBtn}
              href={`/console/programs/blocks?patient=${clientId}&month=${calendar.nextMonthIso}`}
              aria-label="Next month"
            >
              ›
            </Link>
          </div>
        </header>

        {activeBlock ? (
          <p className={styles.calendarLegend}>
            <span className={styles.legendSwatch} aria-hidden="true" /> {activeBlock.title}
            <span className={styles.legendItem}>
              <StatusDot status="completed" /> Completed
            </span>
            <span className={styles.legendItem}>
              <StatusDot status="scheduled" /> Scheduled
            </span>
            <span className={styles.legendItem}>
              <StatusDot status="missed" /> Missed
            </span>
          </p>
        ) : null}

        <div className={styles.calendarGrid} role="grid">
          {WEEKDAYS.map((day) => (
            <div key={day} className={styles.calendarWeekday}>
              {day}
            </div>
          ))}
          {calendar.weeks.flat().map((day) => (
            <div
              key={day.iso}
              className={[
                styles.calendarDay,
                day.inMonth ? "" : styles.calendarDayOutside,
                day.inActiveBlock ? styles.calendarDayInBlock : "",
                day.isToday ? styles.calendarDayToday : "",
              ].join(" ")}
            >
              <span className={styles.calendarDayNum}>{day.dayOfMonth}</span>
              {day.sessions.map((s) => (
                <Link
                  key={s.id}
                  className={styles.daySession}
                  href={`/console/programs/sessions?patient=${clientId}&session=${s.id}`}
                  title={s.title}
                >
                  <StatusDot status={s.status} />
                  <span className={styles.daySessionTitle}>{s.title}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.sessionList} aria-label="Blocks">
        <h2 className={styles.sessionListTitle}>Blocks</h2>
        {blocks.length === 0 ? (
          <p className={styles.emptyNote}>
            No blocks yet.{canBuild ? " Start one from the Planning page." : ""}
          </p>
        ) : null}
        <ul className={styles.blockList}>
          {blocks.map((block) => (
            <li key={block.id} className={styles.blockRow}>
              <div className={styles.blockInfo}>
                <div className={styles.blockTitleRow}>
                  <span className={styles.blockTitle}>{block.title}</span>
                  <span
                    className={`${styles.blockStatus} ${
                      block.status === "active" ? styles.blockStatusActive : ""
                    }`}
                  >
                    {BLOCK_STATUS_LABELS[block.status]}
                  </span>
                </div>
                {block.focus ? <p className={styles.blockFocus}>{block.focus}</p> : null}
                <p className={styles.blockMeta}>
                  {block.firstSession && block.lastSession
                    ? `${formatSessionDate(block.firstSession)} to ${formatSessionDate(block.lastSession)}`
                    : "No sessions yet"}
                  {` · ${block.completedCount} of ${block.sessionCount} sessions done`}
                  {block.createdByName ? ` · Built by ${block.createdByName}` : ""}
                </p>
              </div>
              {canBuild ? (
                <details className={styles.blockEdit}>
                  <summary className={styles.blockEditSummary}>Edit block</summary>
                  <BlockEditForm block={block} />
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
