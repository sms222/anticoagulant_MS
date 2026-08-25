/**
 * CHA2DS2-VASc stroke risk score.
 * Reference: Lip GYH et al., Chest 2010 ("Refining Clinical Risk
 * Stratification for Predicting Stroke and Thromboembolism in Atrial
 * Fibrillation Using a Novel Risk Factor-Based Approach").
 *
 * Like HAS-BLED, this is never entered as a raw number. Every component
 * is either read from the shared patients.comorbidities checklist or
 * derived automatically:
 *   C  Congestive heart failure / LV dysfunction  — comorbidities (1pt)
 *   H  Hypertension                                — comorbidities (1pt)
 *   A2 Age >= 75                                    — derived from DOB (2pt)
 *   D  Diabetes mellitus                            — comorbidities (1pt)
 *   S2 Prior stroke/TIA/thromboembolism             — comorbidities (2pt)
 *   V  Vascular disease (MI, PAD, aortic plaque)     — comorbidities (1pt)
 *   A  Age 65-74                                     — derived from DOB (1pt)
 *   Sc Sex category female                           — derived from patients.sex (1pt)
 * Max score 9.
 */

export interface Cha2ds2VascFactors {
  chf: boolean;
  hypertension: boolean;
  diabetes: boolean;
  strokeHistory: boolean;
  vascularDisease: boolean;
  age75OrOlder: boolean;
  age65to74: boolean;
  femaleSex: boolean;
}

export interface Cha2ds2VascResult {
  score: number;
  maxScore: number;
  components: Cha2ds2VascFactors;
}

export function cha2ds2VascFromComorbidities(
  comorbidities: string[],
  age: number | null,
  sex: string | null
): Cha2ds2VascFactors {
  const has = (label: string) => comorbidities.includes(label);
  return {
    chf: has("Congestive heart failure / LV dysfunction"),
    hypertension: has("Hypertension"),
    diabetes: has("Diabetes mellitus"),
    strokeHistory: has("Prior stroke / TIA / thromboembolism"),
    vascularDisease: has("Vascular disease (prior MI, PAD, aortic plaque)"),
    age75OrOlder: age !== null && age >= 75,
    age65to74: age !== null && age >= 65 && age < 75,
    femaleSex: sex === "female",
  };
}

export function calculateCha2ds2Vasc(factors: Cha2ds2VascFactors): Cha2ds2VascResult {
  const score =
    (factors.chf ? 1 : 0) +
    (factors.hypertension ? 1 : 0) +
    (factors.age75OrOlder ? 2 : factors.age65to74 ? 1 : 0) +
    (factors.diabetes ? 1 : 0) +
    (factors.strokeHistory ? 2 : 0) +
    (factors.vascularDisease ? 1 : 0) +
    (factors.femaleSex ? 1 : 0);

  return { score, maxScore: 9, components: factors };
}
