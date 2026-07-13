"use client";

import { useCallback, useEffect, useState } from "react";

export interface LogEntry {
  id: string;
  peptideId: string;
  peptideName: string;
  vialMg: number;
  volumeMl: number;
  concentrationMgPerMl: number;
  createdAt: number;
}

const STORAGE_KEY = "tara-peptide-log-v1";

export function usePeptideLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- storage hydration is a legitimate post-mount state sync
      if (raw) setEntries(JSON.parse(raw) as LogEntry[]);
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

  const addEntry = useCallback((entry: Omit<LogEntry, "id" | "createdAt">) => {
    setEntries((prev) => [
      { ...entry, id: crypto.randomUUID(), createdAt: Date.now() },
      ...prev,
    ]);
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearLog = useCallback(() => setEntries([]), []);

  return { entries, addEntry, removeEntry, clearLog, hydrated };
}
