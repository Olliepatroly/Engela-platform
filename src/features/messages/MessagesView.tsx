"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendMessage, type SendMessageState } from "./actions";
import type { Thread } from "./data";
import styles from "./messages.module.css";

const initial: SendMessageState = { error: null, ok: false };

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The client's thread with their care team. Own messages sit on the right, the
 * team's on the left; the sender's name and time label each one. The composer
 * posts through the sendMessage server action (revalidated), then clears.
 */
export function MessagesView({ thread }: { thread: Thread }) {
  const [state, action, pending] = useActionState(sendMessage, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  if (!thread.available) {
    return (
      <div className={styles.unavailable}>
        <p className={styles.unavailableTitle}>Messaging is on its way</p>
        <p className={styles.unavailableNote}>
          You will soon be able to message your team from here. In the meantime, your community can
          reach you as usual.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {thread.messages.length === 0 ? (
        <p className={styles.empty}>
          No messages yet. Say hello, or let your team know how your week is going.
        </p>
      ) : (
        <ul className={styles.thread}>
          {thread.messages.map((m) => (
            <li
              key={m.id}
              className={m.mine ? styles.rowMine : styles.rowTheirs}
              data-from={m.mine ? "you" : "team"}
            >
              <div className={m.mine ? styles.bubbleMine : styles.bubbleTheirs}>
                <p className={styles.body}>{m.body}</p>
                <p className={styles.meta}>
                  {m.mine ? "You" : (m.sender_name ?? "Your team")} · {formatWhen(m.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={action} className={styles.composer}>
        <label className="srOnly" htmlFor="message-body">
          Your message
        </label>
        <textarea
          id="message-body"
          name="body"
          className={styles.input}
          rows={3}
          maxLength={4000}
          placeholder="Write a message to your team"
          required
        />
        {state.error ? (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        ) : null}
        <button className={styles.send} type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send"}
        </button>
      </form>

      <p className={styles.disclaimer}>
        This is not for anything urgent. If you feel unwell, contact your care team the usual way or
        seek medical help.
      </p>
    </div>
  );
}
