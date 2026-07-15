"use client";

import { useCallback, useEffect, useState } from "react";

// Vocabulary: "scheduled window," "amount," "measurement" — never "dose" or
// "injection." See docs/COMPLIANCE.md.

export type IntervalPreset = "12h" | "24h" | "48h" | "weekly" | "custom";

export interface ScheduleEntry {
  id: string;
  compound: string;
  amountMcg: number;
  intervalHours: number;
  /** Start of the first scheduled window, as an epoch ms timestamp. */
  startAt: number;
  notes: string;
  createdAt: number;
}

export type NewScheduleEntry = Omit<ScheduleEntry, "id" | "createdAt">;

const STORAGE_KEY = "tara-schedule-v1";

export function nextWindow(entry: Pick<ScheduleEntry, "startAt" | "intervalHours">, now: number): number {
  const intervalMs = entry.intervalHours * 60 * 60 * 1000;
  if (intervalMs <= 0) return entry.startAt;
  if (now <= entry.startAt) return entry.startAt;
  const elapsed = now - entry.startAt;
  const cycles = Math.ceil(elapsed / intervalMs);
  return entry.startAt + cycles * intervalMs;
}

export function useSchedule() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- storage hydration is a legitimate post-mount state sync
      if (raw) setEntries(JSON.parse(raw) as ScheduleEntry[]);
    } catch {
      // Ignore malformed storage.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Storage may be unavailable (private mode); fail silently.
    }
  }, [entries, hydrated]);

  const addEntry = useCallback((entry: NewScheduleEntry) => {
    const id = crypto.randomUUID();
    setEntries((prev) => [...prev, { ...entry, id, createdAt: Date.now() }]);
    return id;
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { entries, addEntry, removeEntry, hydrated };
}
