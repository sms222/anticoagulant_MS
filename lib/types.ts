export type AnticoagulantType =
  | "warfarin"
  | "rivaroxaban"
  | "apixaban"
  | "dabigatran"
  | "edoxaban"
  | "other";

export interface Patient {
  id: string;
  mrn: string | null;
  name: string;
  date_of_birth: string | null;
  sex: "male" | "female" | null;
  weight_kg: number | null;
  height_cm: number | null;
  indication: string;
  indication_detail: string | null;
  anticoagulant_type: AnticoagulantType;
  target_inr_low: number | null;
  target_inr_high: number | null;
  baseline_creatinine: number | null;
  status: string;
  intake_date: string;
  notes: string | null;
  phone: string | null;
  address: string | null;
  risk_class: "low" | "medium" | "high" | null;
  emergency_contact_info: string | null;
  ethnicity: string | null;
  smoking_status: string | null;
  comorbidities: string[];
  alcohol_excess: boolean;
}

export interface Encounter {
  id: string;
  patient_id: string;
  encounter_date: string;
  current_dose_mg: number | null;
  notes: string | null;
  next_appt_date: string | null;
  audio_transcript: string | null;
  ai_pipeline_used: boolean;
  room: string | null;
  seen_by: string | null;
  seen_by_name?: string | null;
}

export interface Pharmacist {
  id: string;
  full_name: string;
}

export type AppointmentType = "routine_followup" | "telephone_followup" | "urgent_walkin";
export type AppointmentStatus = "scheduled" | "checked_in" | "with_pharmacist" | "completed" | "no_show" | "cancelled";

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  routine_followup: "Routine follow-up",
  telephone_followup: "Telephone follow-up",
  urgent_walkin: "Urgent (walk-in)",
};

export interface TodaysAppointment {
  id: string;
  patient_id: string;
  scheduled_time: string;
  room: string | null;
  status: AppointmentStatus;
  appointment_type: AppointmentType;
  pharmacist_id: string | null;
  pharmacist_name: string | null;
  patient_name: string;
  anticoagulant_type: string;
  target_inr_low: number | null;
  target_inr_high: number | null;
  last_inr: number | null;
  visit_started_at: string | null;
  visit_elapsed_seconds: number;
}

export interface LabResult {
  id: string;
  patient_id: string;
  test_name: string;
  result_value: number;
  unit: string | null;
  test_date: string;
  source: "manual" | "ems_screenshot_ai" | "ems_screenshot_manual";
}

export interface ScoringResult {
  id: string;
  patient_id: string;
  score_date: string;
  score_value: number;
  tool_name: string;
  components: Record<string, unknown> | null;
}

export interface ClinicalEvent {
  id: string;
  patient_id: string;
  event_type: "bleeding" | "clotting" | "hospitalization" | "other";
  bleeding_severity: "major" | "crnm" | "minor" | null;
  event_date: string;
  description: string;
  inr_at_event: number | null;
  outcome: string | null;
}

export interface Medication {
  id: string;
  patient_id: string;
  drug_name: string;
  dose: string;
  frequency: string;
  route: string | null;
  indication: string | null;
  start_date: string;
  stop_date: string | null;
  active: boolean;
  notes: string | null;
}

export interface Reminder {
  id: string;
  patient_id: string;
  task: string;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface BiometricsHistoryEntry {
  id: string;
  patient_id: string;
  weight_kg: number | null;
  height_cm: number | null;
  effective_date: string;
}

export interface PatientDocument {
  id: string;
  patient_id: string;
  label: string;
  url: string;
  added_at: string;
}

export interface TargetInrHistoryEntry {
  id: string;
  patient_id: string;
  target_inr: number;
  target_inr_low: number;
  target_inr_high: number;
  effective_date: string;
}

export interface FollowUpStatus {
  patient_id: string;
  next_appt_date: string | null;
  last_encounter_date: string;
  patient_name?: string;
}

export const INDICATION_OPTIONS: { value: string; label: string }[] = [
  { value: "af_nonvalvular", label: "AF – Nonvalvular" },
  { value: "af_valvular", label: "AF – Valvular" },
  { value: "mechanical_valve", label: "Mechanical valve" },
  { value: "vte_dvt", label: "VTE – DVT" },
  { value: "vte_pe", label: "VTE – PE" },
  { value: "other", label: "Other" },
];

export function formatIndication(indication: string, detail?: string | null): string {
  const known = INDICATION_OPTIONS.find((o) => o.value === indication);
  if (indication === "other" && detail) return detail;
  return known ? known.label : indication.replace(/_/g, " ");
}

export const EMERGENCY_CONTACT_TEMPLATE = `Next of kin:
Relationship:
Phone:
Alternate phone:
Email:

Secondary contact:
Relationship:
Phone:
`;

export const COMORBIDITY_OPTIONS: string[] = [
  "Hypertension",
  "Diabetes mellitus",
  "Congestive heart failure / LV dysfunction",
  "Vascular disease (prior MI, PAD, aortic plaque)",
  "Prior stroke / TIA / thromboembolism",
  "Chronic kidney disease / renal impairment",
  "Hepatic impairment / liver disease",
  "Dyslipidemia",
  "Thyroid disorder",
  "Prior major bleeding",
  "Malignancy",
];

export const ETHNICITY_OPTIONS: string[] = ["Malay", "Chinese", "Indian", "Bumiputera Sabah/Sarawak", "Other"];

export const SMOKING_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "never", label: "Never smoked" },
  { value: "former", label: "Former smoker" },
  { value: "current", label: "Current smoker" },
];

export interface NoacDosingReference {
  drug: string;
  standardDose: string;
  reducedDose: string;
  reductionCriteria: string;
  renalNotes: string;
  source: string;
  sourceUrl: string;
}

/**
 * Reference dosing for stroke prevention in nonvalvular AF. Pulled from
 * manufacturer prescribing information / FDA labeling (see source links) —
 * verify against the current local (NPRA-approved Malaysian) package insert
 * before applying to a specific patient; labeling can differ by region and
 * changes over time. This is reference information, not a substitute for
 * checking the actual product insert or current clinical guidelines.
 */
export interface LabTestDefinition {
  name: string;
  category: string;
  defaultUnit: string;
}

/**
 * Reference range values below are commonly-cited adult reference ranges —
 * they vary by lab, analyzer, and population, so treat these as a rough
 * flag, not a diagnostic threshold, and confirm against your own lab's
 * reported reference range.
 */
export const LAB_TEST_CATALOG: LabTestDefinition[] = [
  { name: "INR", category: "Coagulation", defaultUnit: "" },
  { name: "PT", category: "Coagulation", defaultUnit: "sec" },
  { name: "aPTT", category: "Coagulation", defaultUnit: "sec" },
  { name: "Serum creatinine", category: "Renal Function", defaultUnit: "µmol/L" },
  { name: "eGFR", category: "Renal Function", defaultUnit: "mL/min/1.73m²" },
  { name: "Hemoglobin", category: "Hematology", defaultUnit: "g/dL" },
  { name: "Hematocrit", category: "Hematology", defaultUnit: "%" },
  { name: "Platelet count", category: "Hematology", defaultUnit: "x10⁹/L" },
  { name: "AST", category: "Hepatic Function", defaultUnit: "U/L" },
  { name: "ALT", category: "Hepatic Function", defaultUnit: "U/L" },
  { name: "Bilirubin", category: "Hepatic Function", defaultUnit: "µmol/L" },
];

export const LAB_CATEGORIES: string[] = Array.from(new Set(LAB_TEST_CATALOG.map((t) => t.category)));

export const NOAC_DOSING: Record<string, NoacDosingReference> = {
  rivaroxaban: {
    drug: "Rivaroxaban (Xarelto)",
    standardDose: "20 mg once daily with the evening meal",
    reducedDose: "15 mg once daily with the evening meal",
    reductionCriteria: "CrCl 15–50 mL/min",
    renalNotes: "Avoid use if CrCl < 15 mL/min (limited data). Periodically reassess renal function.",
    source: "Xarelto full prescribing information, Janssen (FDA label)",
    sourceUrl: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2018/022406s028lbl.pdf",
  },
  apixaban: {
    drug: "Apixaban (Eliquis)",
    standardDose: "5 mg twice daily",
    reducedDose: "2.5 mg twice daily",
    reductionCriteria: "≥2 of: age ≥80y, body weight ≤60kg, serum creatinine ≥1.5 mg/dL",
    renalNotes: "Dose reduction is based on age/weight/creatinine criteria, not CrCl directly.",
    source: "Eliquis Dosing Guide, Bristol Myers Squibb / Pfizer",
    sourceUrl: "https://www.eliquis.com/assets/buildeasy/us-commercial/eliquis-hcp/en/resources/pdf/Eliquis-Dosing-Guide-Desktop-Version.pdf",
  },
  dabigatran: {
    drug: "Dabigatran (Pradaxa)",
    standardDose: "150 mg twice daily",
    reducedDose: "110 mg twice daily (most markets outside the US) or 75 mg twice daily (US label, severe renal impairment)",
    reductionCriteria: "US label: CrCl 15–30 mL/min → 75mg. Elsewhere (incl. Malaysia's NPRA label), 110mg is also used for age ≥80, high bleeding risk, or verapamil co-therapy — confirm against the local package insert, the 110mg indication differs from the US FDA label.",
    renalNotes: "Assess renal function before starting and periodically thereafter — dabigatran is the most renally-cleared of the four.",
    source: "Pradaxa full prescribing information, Boehringer Ingelheim (FDA label)",
    sourceUrl: "https://content.boehringer-ingelheim.com/DAM/c669f898-0c4e-45a2-ba55-af1e011fdf63/pradaxa%20capsules-us-pi.pdf",
  },
  edoxaban: {
    drug: "Edoxaban (Lixiana/Savaysa)",
    standardDose: "60 mg once daily",
    reducedDose: "30 mg once daily",
    reductionCriteria: "Any of: CrCl 15–50 mL/min, body weight ≤60kg, certain P-gp inhibitors",
    renalNotes: "Do not use if CrCl > 95 mL/min (reduced efficacy vs warfarin at this dose in trial data) — an alternative anticoagulant is advised instead.",
    source: "Savaysa full prescribing information, DailyMed / FDA label",
    sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=e77d3400-56ad-11e3-949a-0800200c9a66",
  },
};

// Frequency is intrinsic to the drug's approved regimen (only the mg amount
// varies with renal function/age/weight) — used to label dose-group buckets
// in reports without needing a separate frequency field on every patient.
export const NOAC_FREQUENCY: Record<string, string> = {
  rivaroxaban: "OD",
  apixaban: "BD",
  dabigatran: "BD",
  edoxaban: "OD",
};

export function isWarfarin(patient: Patient): boolean {
  return patient.anticoagulant_type === "warfarin";
}

export function calculateAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}
