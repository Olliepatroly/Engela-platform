"use client";

import { useState, useTransition } from "react";

import { BodyMapRate, type EffortMap, type MuscleGroup } from "@/components/ui";
import { recordPerceivedEffort } from "./actions";
import styles from "./client-program.module.css";

/**
 * Connects the interactive body map to the perceived-effort action. Clients
 * (and care-team trainers) tap a worked region and rate how hard it felt on
 * Borg CR10; the value is saved and optimistically reflected. Read-only mode
 * shows the same map for review without input.
 */
export function SessionEffortMap({
  sessionId,
  regions,
  aimed,
  effort: initialEffort,
  figure,
  readOnly = false,
}: {
  sessionId: string;
  regions: MuscleGroup[];
  aimed: EffortMap;
  effort: EffortMap;
  figure: "male" | "female";
  readOnly?: boolean;
}) {
  const [effort, setEffort] = useState<EffortMap>(initialEffort);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [, startTransition] = useTransition();

  function onRate(muscle: MuscleGroup, value: number) {
    const previous = effort;
    setEffort((prev) => ({ ...prev, [muscle]: value })); // optimistic
    setMessage(null);
    startTransition(async () => {
      const result = await recordPerceivedEffort({ sessionId, muscle, value });
      if (result.error) {
        setEffort(previous); // revert
        setIsError(true);
        setMessage(result.error);
      } else {
        setIsError(false);
        setMessage(result.success);
      }
    });
  }

  return (
    <div>
      <BodyMapRate
        regions={regions}
        aimed={aimed}
        effort={effort}
        figure={figure}
        readOnly={readOnly}
        onRate={onRate}
      />
      {message ? (
        <p
          className={isError ? styles.effortError : styles.effortSaved}
          role={isError ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
