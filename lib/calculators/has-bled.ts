/**
 * HAS-BLED bleeding risk score.
 * Reference: Pisters R et al., Chest 2010.
 *
 * The score is never entered directly — the engine computes it from
 * component variables. Some of those variables can be derived from data
 * already in the system rather than asked of the clinician:
 *   - Elderly (>65)      — from date of birth
 *   - Labile INR          — from this patient's own computed TTR (<60%)
 *   - Drugs predisposing   — from the active medications list (antiplatelets/NSAIDs)
 * The rest (hypertension, abnormal renal/liver function, stroke history,
 * bleeding history/predisposition, alcohol excess) aren't derivable from
 * structured data here and are asked for directly.
 */

export interface HasBledManualInputs {
  hypertension: boolean; // uncontrolled, SBP > 160
  abnormalRenal: boolean; // dialysis, transplant, or Cr > 200 umol/L
  abnormalLiver: boolean; // cirrhosis, bilirubin > 2x normal, or AST/ALT/ALP > 3x normal
  strokeHistory: boolean;
  bleedingHistory: boolean; // prior major bleed or predisposition (e.g. anemia)
  alcoholExcess: boolean; // >= 8 units/week
}

export interface HasBledAutoFactors {
  elderly: boolean; // age > 65
  labileInr: boolean; // TTR < 60%
  interactingDrugs: boolean; // active antiplatelet/NSAID
}

export interface HasBledResult {
  score: number;
  maxScore: number;
  components: HasBledManualInputs & HasBledAutoFactors;
}

const ANTIPLATELET_NSAID_KEYWORDS = [
  "aspirin",
  "clopidogrel",
  "ticagrelor",
  "prasugrel",
  "dipyridamole",
  "ibuprofen",
  "naproxen",
  "diclofenac",
  "mefenamic",
  "celecoxib",
  "meloxicam",
  "nsaid",
];

export function detectInteractingDrugs(activeDrugNames: string[]): boolean {
  return activeDrugNames.some((name) =>
    ANTIPLATELET_NSAID_KEYWORDS.some((kw) => name.toLowerCase().includes(kw))
  );
}

export function calculateHasBled(
  manual: HasBledManualInputs,
  auto: HasBledAutoFactors
): HasBledResult {
  const components = { ...manual, ...auto };
  const score =
    (manual.hypertension ? 1 : 0) +
    (manual.abnormalRenal ? 1 : 0) +
    (manual.abnormalLiver ? 1 : 0) +
    (manual.strokeHistory ? 1 : 0) +
    (manual.bleedingHistory ? 1 : 0) +
    (manual.alcoholExcess ? 1 : 0) +
    (auto.elderly ? 1 : 0) +
    (auto.labileInr ? 1 : 0) +
    (auto.interactingDrugs ? 1 : 0);

  return { score, maxScore: 9, components };
}
