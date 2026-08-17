"use client";

import { createContext, useContext } from "react";

/**
 * Destinations any card can open without knowing how the shell stores tab
 * state. Extended from Today-cards-only to the whole file: a card that names
 * an action ("next up — creatine · morning") must be able to open the page
 * that performs it, sub-view included — dead text naming live work was the
 * critique's recognition-over-recall failure.
 */
export type FileNavTab = "today" | "fuel" | "train" | "body" | "mind" | "crew" | "shop";
export type FileNavSub = "stack" | "supply" | "labs" | "trend" | "checkin" | "craving";

const FileNavContext = createContext<(tab: FileNavTab, sub?: FileNavSub) => void>(() => {});

export const FileNavProvider = FileNavContext.Provider;

export function useFileNav() {
  return useContext(FileNavContext);
}
