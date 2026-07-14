// Reconstitution math — ported from the design handoff's calculator logic
// (mg, BAC water, target amount -> concentration, draw volume, U-100 units,
// draws/vial). Deliberately stops at solution concentration and syringe
// units; it does not recommend a personal amount to administer. See
// docs/COMPLIANCE.md for the vocabulary this file (and its callers) follow —
// "amount," never "dose."

export const DEFAULT_BAC_ML = 2;

export interface CalcResult {
  valid: boolean;
  /** Concentration, in mcg per mL. */
  concentrationMcgPerMl: number;
  /** Volume drawn for the target amount, in mL. */
  drawMl: number;
  /** Draw volume expressed in U-100 insulin-syringe units (1 unit = 0.01 mL). */
  units: number;
  /** How many draws of the target amount the vial yields. */
  drawsPerVial: number;
  /** True once the draw exceeds a single U-100 syringe (100 units / 1 mL). */
  overfill: boolean;
  fillPct: number;
}

export function calculate(vialMg: number, bacMl: number, targetMcg: number): CalcResult {
  const totalMcg = vialMg * 1000;
  const concentrationMcgPerMl = bacMl > 0 ? totalMcg / bacMl : 0;
  const drawMl = concentrationMcgPerMl > 0 ? targetMcg / concentrationMcgPerMl : 0;
  const units = drawMl * 100;
  const drawsPerVial = targetMcg > 0 ? Math.floor(totalMcg / targetMcg) : 0;
  const valid = vialMg > 0 && bacMl > 0 && targetMcg > 0 && units > 0;

  return {
    valid,
    concentrationMcgPerMl,
    drawMl,
    units,
    drawsPerVial,
    overfill: valid && units > 100,
    fillPct: valid ? Math.max(2, Math.min(100, units)) : 0,
  };
}
