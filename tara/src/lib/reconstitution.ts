// Pure solution-concentration math for the reconstitution calculator.
// Deliberately stops at "concentration" — it does not recommend or compute
// a personal dose. See docs/COMPLIANCE.md.

export const DEFAULT_RECONSTITUTION_ML = 2;

export interface ConcentrationResult {
  vialMg: number;
  volumeMl: number;
  /** Resulting concentration, in mg per mL. */
  concentrationMgPerMl: number;
  /** Resulting concentration, in mcg per 0.1 mL — the common draw increment. */
  mcgPerTenthMl: number;
}

export function computeConcentration(vialMg: number, volumeMl: number): ConcentrationResult {
  const concentrationMgPerMl = volumeMl > 0 ? vialMg / volumeMl : 0;
  return {
    vialMg,
    volumeMl,
    concentrationMgPerMl,
    mcgPerTenthMl: concentrationMgPerMl * 1000 * 0.1,
  };
}

/** A draw-volume reference table from 0.1 mL up to the full reconstituted volume. */
export function drawTable(vialMg: number, volumeMl: number): { drawMl: number; mcg: number }[] {
  const { concentrationMgPerMl } = computeConcentration(vialMg, volumeMl);
  const steps = Math.round(volumeMl / 0.1);
  return Array.from({ length: steps }, (_, i) => {
    const drawMl = Math.round((i + 1) * 0.1 * 100) / 100;
    return { drawMl, mcg: Math.round(drawMl * concentrationMgPerMl * 1000) };
  });
}
