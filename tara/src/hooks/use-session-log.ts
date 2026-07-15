"use client";

import { useCallback, useEffect, useState } from "react";

export interface SessionLogRow {
  id: string;
  compound: string;
  /** e.g. "5 mg / 2 mL" */
  reconstitutionSpec: string;
  units: number;
  drawMl: number;
  drawsPerVial: number;
  createdAt: number;
}

const STORAGE_KEY = "tara-session-log-v1";

export function useSessionLog() {
  const [rows, setRows] = useState<SessionLogRow[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- storage hydration is a legitimate post-mount state sync
      if (raw) setRows(JSON.parse(raw) as SessionLogRow[]);
    } catch {
      // Ignore malformed storage.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {
      // Storage may be unavailable (private mode); fail silently.
    }
  }, [rows, hydrated]);

  const addRow = useCallback((row: Omit<SessionLogRow, "id" | "createdAt">) => {
    setRows((prev) => [{ ...row, id: crypto.randomUUID(), createdAt: Date.now() }, ...prev]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearLog = useCallback(() => setRows([]), []);

  return { rows, addRow, removeRow, clearLog, hydrated };
}
