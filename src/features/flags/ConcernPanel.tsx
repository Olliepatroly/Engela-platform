"use client";

import { useEffect, useRef, useState } from "react";
import { raiseClientConcern } from "./actions";
import styles from "./flags.module.css";

type RecState = "idle" | "recording" | "recorded";

const MAX_SECONDS = 120;

/**
 * The client's way to tell the team something did not feel right during a
 * session they did on their own. They describe it in a short voice note (or
 * type it if the microphone is unavailable), tiered as minor or major. The
 * emergency guidance is always visible: for anything serious, call 999 first,
 * this panel does not alert emergency services.
 *
 * Calm styling only: amber emphasis, never red, never "flag" styling
 * (CLAUDE.md §2). The team reviews concerns on the console.
 */
export function ConcernPanel({ sessionId }: { sessionId: string }) {
  const [tier, setTier] = useState<"minor" | "major">("minor");
  const [recState, setRecState] = useState<RecState>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [typeInstead, setTypeInstead] = useState(false);
  const [micUnavailable, setMicUnavailable] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && (!navigator.mediaDevices || !window.MediaRecorder)) {
      setMicUnavailable(true);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount cleanup only
  }, []);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 48000 })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        setRecState("recorded");
        stream.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stopRecording();
          return s + 1;
        });
      }, 1000);
    } catch {
      setMicUnavailable(true);
      setTypeInstead(true);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const discardRecording = () => {
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecState("idle");
  };

  const submit = async () => {
    setError(null);
    if (!audioBlob && !transcript.trim()) {
      setError("Record a voice note or describe what happened first.");
      return;
    }
    setPending(true);
    const formData = new FormData();
    formData.set("tier", tier);
    formData.set("sessionId", sessionId);
    if (audioBlob) {
      const ext = audioBlob.type.includes("mp4") ? "m4a" : "webm";
      formData.set("audio", new File([audioBlob], `concern.${ext}`, { type: audioBlob.type }));
    }
    if (transcript.trim()) formData.set("transcript", transcript.trim());
    const result = await raiseClientConcern(formData);
    setPending(false);
    if (result.error) setError(result.error);
    else setSent(true);
  };

  if (sent) {
    return (
      <section className={styles.concern} aria-label="Concern sent">
        <h2 className={styles.concernTitle}>Thank you, your team has it</h2>
        <p className={styles.concernIntro}>
          Someone from your team will listen and come back to you. If anything gets worse in the
          meantime, contact them directly, and for anything serious call 999.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.concern} aria-label="Raise a concern about this session">
      <h2 className={styles.concernTitle}>Did something not feel right?</h2>
      <p className={styles.concernIntro}>
        If anything felt wrong during this session, tell your team here. Describe what happened in
        your own words, a short voice note is perfect, and they will review it.
      </p>

      <p className={styles.emergency}>
        If this is serious, call 999 immediately: chest pain, severe breathlessness, fainting, or
        anything that feels like an emergency. This form tells your team; it does not alert
        emergency services.
      </p>

      <div className={styles.concernTierRow} role="radiogroup" aria-label="How concerning was it">
        <label className={styles.concernTier}>
          <input
            type="radio"
            name="concern-tier"
            checked={tier === "minor"}
            onChange={() => setTier("minor")}
          />
          Something to mention: it passed, but your team should know.
        </label>
        <label className={styles.concernTier}>
          <input
            type="radio"
            name="concern-tier"
            checked={tier === "major"}
            onChange={() => setTier("major")}
          />
          It worried me: you felt unwell or something seemed wrong. If it still feels wrong now,
          call 999 first.
        </label>
      </div>

      {!typeInstead && !micUnavailable ? (
        <div className={styles.recorderRow}>
          {recState === "idle" ? (
            <button className={styles.recordBtn} type="button" onClick={startRecording}>
              Start voice note
            </button>
          ) : null}
          {recState === "recording" ? (
            <>
              <button
                className={`${styles.recordBtn} ${styles.recordBtnStop}`}
                type="button"
                onClick={stopRecording}
              >
                Stop
              </button>
              <span className={styles.recordingNote} role="status">
                Recording... {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} (up
                to 2:00)
              </span>
            </>
          ) : null}
          {recState === "recorded" && audioUrl ? (
            <>
              <audio controls src={audioUrl} />
              <button className={styles.typeToggle} type="button" onClick={discardRecording}>
                Record again
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {!typeInstead && !micUnavailable ? (
        <button className={styles.typeToggle} type="button" onClick={() => setTypeInstead(true)}>
          Type it instead
        </button>
      ) : null}

      {typeInstead || micUnavailable ? (
        <label className={styles.fieldLabel}>
          What happened
          <textarea
            className={styles.textarea}
            rows={4}
            maxLength={4000}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Describe what you felt and when it happened"
          />
        </label>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <button className={styles.recordBtn} type="button" onClick={submit} disabled={pending}>
        {pending ? "Sending..." : "Send to your team"}
      </button>
    </section>
  );
}
