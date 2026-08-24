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

export interface PatientDocument {
  id: string;
  patient_id: string;
  label: string;
  url: string;
  added_at: string;
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
