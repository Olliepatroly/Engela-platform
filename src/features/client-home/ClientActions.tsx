"use client";

import { useState, useTransition } from "react";
import { toggleAction } from "./actions";
import type { ClientHomeVM } from "./data";
import styles from "./client-home.module.css";

type Action = ClientHomeVM["actions"][number];

/**
 * "This week's focus" actions. Tickable once migration 0016 is applied (the
 * payload then carries `done` on every action); until then `done` is undefined
 * and this renders the plain, non-tickable list exactly as before. This lets the
 * feature ship ahead of the migration without breaking production.
 */
export function ClientActions({ actions }: { actions: Action[] }) {
  const tickable = actions.length > 0 && actions.every((a) => a.done !== undefined);

  if (!tickable) {
    return (
      <ul className={styles.focusList}>
        {actions.map((a) => (
          <li key={a.id} className={styles.focusItem}>
            {a.text}
          </li>
        ))}
      </ul>
    );
  }

  return <TickableList actions={actions} />;
}

function TickableList({ actions }: { actions: Action[] }) {
  const [done, setDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(actions.map((a) => [a.id, Boolean(a.done)])),
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const toggle = (id: string) => {
    const next = !done[id];
    setDone((prev) => ({ ...prev, [id]: next })); // optimistic
    setError(null);
    startTransition(async () => {
      const res = await toggleAction(id, next);
      if (res.error) {
        setDone((prev) => ({ ...prev, [id]: !next })); // revert on failure
        setError(res.error);
      }
    });
  };

  return (
    <>
      <ul className={styles.checkList}>
        {actions.map((a) => {
          const isDone = done[a.id];
          return (
            <li key={a.id}>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  className={styles.checkInput}
                  checked={isDone}
                  onChange={() => toggle(a.id)}
                />
                <span className={isDone ? styles.checkTextDone : styles.checkText}>{a.text}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className={styles.checkError} role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
