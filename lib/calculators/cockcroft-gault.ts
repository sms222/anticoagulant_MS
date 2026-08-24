/**
 * Cockcroft-Gault creatinine clearance, used for NOAC/DOAC renal dosing checks.
 * Reference: Cockcroft DW, Gault MH. Nephron. 1976.
 *
 * CrCl (mL/min) = [(140 - age) x weight(kg) x (0.85 if female)] / (72 x SCr(mg/dL))
 *
 * SCr must be in mg/dL. If your lab reports umol/L, convert first
 * (mg/dL = umol/L / 88.4).
 */

export interface CockcroftGaultInput {
  ageYears: number;
  weightKg: number;
  serumCreatinineMgDl: number;
  sex: "male" | "female";
}

export function calculateCockcroftGault({
  ageYears,
  weightKg,
  serumCreatinineMgDl,
  sex,
}: CockcroftGaultInput): number {
  if (serumCreatinineMgDl <= 0 || ageYears <= 0 || weightKg <= 0) {
    throw new Error("Age, weight, and serum creatinine must be positive values.");
  }

  const sexFactor = sex === "female" ? 0.85 : 1;
  const crCl = ((140 - ageYears) * weightKg * sexFactor) / (72 * serumCreatinineMgDl);

  return Math.round(crCl * 10) / 10; // one decimal place
}

export function convertCreatinineUmolLToMgDl(umolL: number): number {
  return umolL / 88.4;
}
