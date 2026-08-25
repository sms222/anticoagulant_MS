/**
 * HAS-BLED bleeding risk score.
 * Reference: Pisters R et al., Chest 2010.
 *
 * The score is never entered directly — the engine computes it from
 * component variables, most of which are read from the patient's recorded
 * comorbidities list (single source of truth, shared with CHA2DS2-VASc —
 * see cha2ds2-vasc.ts) rather than asked again here. Only what's genuinely
 * unique to bleeding risk gets asked: alcohol excess.
 *   - Hypertension, abnormal renal function, abnormal liver function, stroke
 *     history, bleeding history — read from patients.comorbidities
 *   - Elderly (>65)      — derived from date of birth
 *   - Labile INR          — derived from this patient's own computed TTR (<60%)
 *   - Drugs predisposing   — derived from the active medications list (antiplatelets/NSAIDs)
 *   - Alcohol excess      — asked directly (not a comorbidity, a social-history flag)
 */

export interface HasBledInputs {
  hypertension: boolean;
  abnormalRenal: boolean;
  abnormalLiver: boolean;
  strokeHistory: boolean;
  bleedingHistory: boolean;
  alcoholExcess: boolean;
}

export interface HasBledAutoFactors {
  elderly: boolean; // age > 65
  labileInr: boolean; // TTR < 60%
  interactingDrugs: boolean; // active antiplatelet/NSAID
}

export interface HasBledResult {
  score: number;
  maxScore: number;
  components: HasBledInputs & HasBledAutoFactors;
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

/** Maps the shared comorbidities checklist onto the HAS-BLED-specific inputs
 *  it can be derived from. Alcohol excess isn't a comorbidity, it's passed
 *  in separately from patients.alcohol_excess. */
export function hasBledInputsFromComorbidities(
  comorbidities: string[],
  alcoholExcess: boolean
): HasBledInputs {
  const has = (label: string) => comorbidities.includes(label);
  return {
    hypertension: has("Hypertension"),
    abnormalRenal: has("Chronic kidney disease / renal impairment"),
    abnormalLiver: has("Hepatic impairment / liver disease"),
    strokeHistory: has("Prior stroke / TIA / thromboembolism"),
    bleedingHistory: has("Prior major bleeding"),
    alcoholExcess,
  };
}

export function calculateHasBled(
  manual: HasBledInputs,
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
