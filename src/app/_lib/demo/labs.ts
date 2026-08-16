import { markerByKey } from "@convex/tm/data/markers";
import {
  buildLabsView,
  type LabsViewInput,
  type RawLabPanel,
  type RawLabResult,
} from "@convex/tm/logicLabs";
import type { DemoDb } from "../demo-db";
import type { LabResultInput, LabsData } from "../types";

/**
 * Demo mirror of convex/tm/labs.ts. Same gather, same shared logic, same shape —
 * the view type is derived from the Convex query, so any drift is a build error.
 */

const MAX_RESULTS_PER_PANEL = 80;

function gather(db: DemoDb, slug: string, date: string): LabsViewInput {
  const user = db.users.find((u) => u.slug === slug);
  if (!user) throw new Error("Unknown user");

  const panels: RawLabPanel[] = db.labPanels
    .filter((p) => p.userSlug === slug)
    .map((p) => ({
      id: p.id,
      date: p.date,
      name: p.name,
      lab: p.lab ?? null,
      fasted: p.fasted ?? null,
    }));

  const results: RawLabResult[] = db.labResults
    .filter((r) => r.userSlug === slug)
    .map((r) => ({
      panelId: r.panelId,
      date: r.date,
      marker: r.marker,
      value: r.value,
      unit: r.unit,
      refLow: r.refLow ?? null,
      refHigh: r.refHigh ?? null,
    }));

  return { mode: user.modeMut, date, panels, results };
}

export function view(db: DemoDb, slug: string, date: string): LabsData {
  return buildLabsView(gather(db, slug, date));
}

export function addPanel(
  db: DemoDb,
  slug: string,
  date: string,
  name: string,
  results: LabResultInput[],
  fasted?: boolean,
): void {
  if (results.length === 0) throw new Error("empty-panel");
  if (results.length > MAX_RESULTS_PER_PANEL) throw new Error("panel-too-large");
  for (const r of results) {
    if (!markerByKey(r.marker)) throw new Error("unknown-marker");
    if (!Number.isFinite(r.value)) throw new Error("bad-value");
  }

  const panelId = db.newId("lp");
  db.labPanels.push({
    id: panelId,
    userSlug: slug,
    date,
    name: name.trim().slice(0, 80) || "Panel",
    fasted,
  });
  for (const r of results) {
    const def = markerByKey(r.marker);
    db.labResults.push({
      userSlug: slug,
      panelId,
      date,
      marker: r.marker,
      value: r.value,
      unit: r.unit,
      refLow: def?.refLow,
      refHigh: def?.refHigh,
    });
  }
}
