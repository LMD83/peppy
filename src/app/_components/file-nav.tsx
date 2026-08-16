"use client";

import { createContext, useContext } from "react";

/** Destinations Today cards can open without knowing how the shell stores tab state. */
export type FileNavTab = "today" | "fuel" | "train" | "body" | "mind" | "crew";

const FileNavContext = createContext<(tab: FileNavTab) => void>(() => {});

export const FileNavProvider = FileNavContext.Provider;

export function useFileNav() {
  return useContext(FileNavContext);
}
