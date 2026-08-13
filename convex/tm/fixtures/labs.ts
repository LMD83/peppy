import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { markerByKey } from "../data/markers";
import { addDays } from "../lib";

/**
 * Labs fixtures — three draws for Liam across a cut, one recent basic panel for
 * Conor while he rehabs a knee.
 *
 * Row shapes are redeclared here rather than imported: Convex code must not
 * reach into src/. They are field-identical to src/app/_lib/demo/rows.ts,
 * which is the contract.
 *
 * Every value is a plausible reading for a 38-year-old male in Ireland and is
 * internally consistent with the rest of the file: lipids and liver enzymes
 * improve as the cut runs, hs-CRP settles after the first draw, ferritin and
 * transferrin saturation drift down (training plus a deficit plus no red meat),
 * and vitamin D never clears 50 nmol/L at this latitude.
 */

export type LabPanelRow = {
  id: string;
  userSlug: string;
  date: string;
  name: string;
  lab?: string;
  fasted?: boolean;
};

export type LabResultRow = {
  userSlug: string;
  panelId: string;
  date: string;
  marker: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
};

export type LabsFixtures = {
  labPanels: LabPanelRow[];
  labResults: LabResultRow[];
};

type Draw = [marker: string, value: number];

/** Baseline, before the cut started — the panel the whole file is measured against. */
const LIAM_BASELINE: Draw[] = [
  ["total_cholesterol", 5.6],
  ["ldl_c", 3.6],
  ["hdl_c", 1.05],
  ["non_hdl_c", 4.55],
  ["chol_hdl_ratio", 5.33],
  ["triglycerides", 2.1],
  ["apob", 1.18],
  ["lp_a", 28],
  ["glucose_fasting", 5.4],
  ["hba1c", 38],
  ["insulin_fasting", 13.2],
  ["homa_ir", 3.2],
  ["uric_acid", 401],
  ["hs_crp", 3.8],
  // Drawn to settle the disputed MTHFR call — high, and never repeated since.
  ["homocysteine", 15.8],
  ["alt", 46],
  ["ast", 34],
  ["ggt", 58],
  ["alp", 78],
  ["bilirubin_total", 12],
  ["albumin", 45],
  ["creatinine", 91],
  ["egfr", 88],
  ["urea", 6.1],
  ["sodium", 140],
  ["potassium", 4.4],
  ["haemoglobin", 149],
  ["haematocrit", 0.45],
  ["mcv", 88],
  ["platelets", 262],
  ["wbc", 6.8],
  ["ferritin", 42],
  ["transferrin_sat", 24],
  ["testosterone_total", 13.5],
  ["shbg", 31],
  ["oestradiol", 118],
  ["tsh", 2.2],
  ["free_t4", 15.1],
  ["vitamin_d", 38],
  ["vitamin_b12", 342],
  ["folate_serum", 6.8],
];

/** Ninety days in: lipids moving, inflammation settling, iron starting to slide. */
const LIAM_MID: Draw[] = [
  ["total_cholesterol", 5.1],
  ["ldl_c", 3.2],
  ["hdl_c", 1.15],
  ["non_hdl_c", 3.95],
  ["chol_hdl_ratio", 4.43],
  ["triglycerides", 1.5],
  ["apob", 1.02],
  ["glucose_fasting", 5.1],
  ["hba1c", 36],
  ["insulin_fasting", 9.1],
  ["homa_ir", 2.1],
  ["hs_crp", 1.9],
  ["alt", 38],
  ["ast", 30],
  ["ggt", 44],
  ["haemoglobin", 145],
  ["ferritin", 34],
  ["transferrin_sat", 22],
  ["testosterone_total", 15.2],
  ["tsh", 2.0],
  ["vitamin_d", 47],
];

/** Ten days ago: the lipid work has landed; iron and vitamin D have not. */
const LIAM_RECENT: Draw[] = [
  ["total_cholesterol", 4.6],
  ["ldl_c", 2.7],
  ["hdl_c", 1.32],
  ["non_hdl_c", 3.28],
  ["chol_hdl_ratio", 3.48],
  ["triglycerides", 1.0],
  ["apob", 0.88],
  ["glucose_fasting", 4.9],
  ["hba1c", 34],
  ["insulin_fasting", 6.4],
  ["homa_ir", 1.4],
  ["hs_crp", 0.8],
  ["alt", 29],
  ["ast", 26],
  ["ggt", 31],
  ["haemoglobin", 141],
  ["ferritin", 27],
  ["transferrin_sat", 19],
  ["vitamin_d", 44],
];

/** Conor: the basics, drawn two weeks after knee surgery. */
const CONOR_BASICS: Draw[] = [
  ["haemoglobin", 138],
  ["haematocrit", 0.42],
  ["mcv", 89],
  ["platelets", 296],
  ["wbc", 8.4],
  ["neutrophils", 5.6],
  ["lymphocytes", 2.1],
  ["ferritin", 96],
  ["hs_crp", 6.4],
  ["esr", 22],
  ["glucose_fasting", 5.2],
  ["alt", 33],
  ["ast", 28],
  ["creatinine", 94],
  ["egfr", 91],
  ["urea", 5.4],
  ["sodium", 139],
  ["potassium", 4.5],
  ["tsh", 1.6],
  ["vitamin_d", 44],
];

export function buildLabsFixtures(today: string): LabsFixtures {
  const labPanels: LabPanelRow[] = [];
  const labResults: LabResultRow[] = [];

  const add = (
    id: string,
    userSlug: string,
    date: string,
    name: string,
    lab: string,
    fasted: boolean,
    draws: Draw[],
  ) => {
    labPanels.push({ id, userSlug, date, name, lab, fasted });
    for (const [marker, value] of draws) {
      const def = markerByKey(marker);
      if (!def) continue; // fixtures never invent a marker the catalogue lacks
      labResults.push({
        userSlug,
        panelId: id,
        date,
        marker,
        value,
        unit: def.unit,
        refLow: def.refLow,
        refHigh: def.refHigh,
      });
    }
  };

  add("lp_1", "liam", addDays(today, -180), "Full baseline", "Randox Health", true, LIAM_BASELINE);
  add("lp_2", "liam", addDays(today, -90), "Mid-cut recheck", "Randox Health", true, LIAM_MID);
  add("lp_3", "liam", addDays(today, -10), "Cut checkpoint", "Randox Health", true, LIAM_RECENT);
  add("lp_4", "conor", addDays(today, -14), "Post-op basics", "Beacon Hospital", false, CONOR_BASICS);

  return { labPanels, labResults };
}

/** Panels first, then results against the real panel id. */
export async function seedLabs(
  ctx: MutationCtx,
  uid: (slug: string) => Id<"tm_users">,
  fx: LabsFixtures,
): Promise<void> {
  const panelIds = new Map<string, Id<"tm_labPanels">>();
  for (const row of fx.labPanels) {
    const id = await ctx.db.insert("tm_labPanels", {
      userId: uid(row.userSlug),
      date: row.date,
      name: row.name,
      lab: row.lab,
      fasted: row.fasted,
    });
    panelIds.set(row.id, id);
  }
  for (const row of fx.labResults) {
    const panelId = panelIds.get(row.panelId);
    if (!panelId) continue;
    await ctx.db.insert("tm_labResults", {
      userId: uid(row.userSlug),
      panelId,
      date: row.date,
      marker: row.marker,
      value: row.value,
      unit: row.unit,
      refLow: row.refLow,
      refHigh: row.refHigh,
    });
  }
}
