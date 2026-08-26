import { COMORBIDITY_OPTIONS, formatIndication, type Patient } from "@/lib/types";
import type { AutoFillField, FieldConflict, ParsedPatientSheet } from "./types";

// A minimal shape of what we need from the existing patients row for diffing.
export type ExistingPatientRow = Pick<
  Patient,
  | "name"
  | "date_of_birth"
  | "sex"
  | "weight_kg"
  | "height_cm"
  | "phone"
  | "address"
  | "ethnicity"
  | "smoking_status"
  | "alcohol_excess"
  | "indication"
  | "indication_detail"
  | "anticoagulant_type"
  | "target_inr_low"
  | "baseline_creatinine"
  | "comorbidities"
  | "emergency_contact_info"
  | "notes"
>;

interface ScalarFieldDef {
  field: string;
  label: string;
  sheetValue: unknown;
  systemValue: unknown;
  display: (v: unknown) => string;
}

function eq(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 0.001;
  return String(a) === String(b);
}

export function computeDiff(
  parsed: ParsedPatientSheet,
  existing: ExistingPatientRow | null
): { conflicts: FieldConflict[]; autoFill: AutoFillField[] } {
  const conflicts: FieldConflict[] = [];
  const autoFill: AutoFillField[] = [];

  if (!existing) {
    return { conflicts, autoFill }; // brand-new patient — nothing to diff against
  }

  const systemTargetInr = existing.target_inr_low !== null ? Math.round((existing.target_inr_low + 0.5) * 10) / 10 : null;

  const scalarFields: ScalarFieldDef[] = [
    { field: "name", label: "Full name", sheetValue: parsed.name, systemValue: existing.name, display: String },
    { field: "date_of_birth", label: "Date of birth", sheetValue: parsed.date_of_birth, systemValue: existing.date_of_birth, display: String },
    { field: "sex", label: "Sex", sheetValue: parsed.sex, systemValue: existing.sex, display: String },
    { field: "weight_kg", label: "Weight (kg)", sheetValue: parsed.weight_kg, systemValue: existing.weight_kg, display: String },
    { field: "height_cm", label: "Height (cm)", sheetValue: parsed.height_cm, systemValue: existing.height_cm, display: String },
    { field: "phone", label: "Phone", sheetValue: parsed.phone, systemValue: existing.phone, display: String },
    { field: "address", label: "Address", sheetValue: parsed.address, systemValue: existing.address, display: String },
    { field: "ethnicity", label: "Ethnicity", sheetValue: parsed.ethnicity, systemValue: existing.ethnicity, display: String },
    { field: "smoking_status", label: "Smoking status", sheetValue: parsed.smoking_status, systemValue: existing.smoking_status, display: String },
    {
      field: "alcohol_excess",
      label: "Alcohol excess",
      sheetValue: parsed.alcohol_excess,
      systemValue: existing.alcohol_excess,
      display: (v) => (v ? "Yes" : "No"),
    },
    {
      field: "indication",
      label: "Indication",
      sheetValue: parsed.indication,
      systemValue: existing.indication,
      display: (v) => formatIndication(String(v), parsed.indication_detail ?? existing.indication_detail),
    },
    { field: "anticoagulant_type", label: "Anticoagulant", sheetValue: parsed.anticoagulant_type, systemValue: existing.anticoagulant_type, display: String },
    { field: "target_inr", label: "Target INR", sheetValue: parsed.target_inr, systemValue: systemTargetInr, display: String },
    { field: "baseline_creatinine", label: "Baseline creatinine", sheetValue: parsed.baseline_creatinine, systemValue: existing.baseline_creatinine, display: String },
    { field: "emergency_contact_info", label: "Emergency contact", sheetValue: parsed.emergency_contact_info, systemValue: existing.emergency_contact_info, display: String },
    { field: "notes", label: "Notes", sheetValue: parsed.notes, systemValue: existing.notes, display: String },
  ];

  for (const f of scalarFields) {
    // Blank on the sheet = "not collected" -> never touches the system value.
    if (f.sheetValue === null || f.sheetValue === undefined || f.sheetValue === "") continue;

    if (f.systemValue === null || f.systemValue === undefined || f.systemValue === "") {
      autoFill.push({ field: f.field, label: f.label, value: f.display(f.sheetValue) });
      continue;
    }

    if (!eq(f.sheetValue, f.systemValue)) {
      conflicts.push({
        field: f.field,
        label: f.label,
        sheetValue: f.display(f.sheetValue),
        systemValue: f.display(f.systemValue),
      });
    }
  }

  // Comorbidities: per-item, only for items the sheet actually answered (Yes or No).
  // A blank row on the sheet leaves that item alone entirely.
  const systemComorbidities = new Set(existing.comorbidities ?? []);
  for (const c of COMORBIDITY_OPTIONS) {
    if (!parsed.comorbiditiesRecorded.includes(c)) continue; // left blank on sheet — don't touch
    const sheetHas = parsed.comorbidities.includes(c);
    const systemHas = systemComorbidities.has(c);
    if (sheetHas !== systemHas) {
      conflicts.push({
        field: `comorbidity:${c}`,
        label: c,
        sheetValue: sheetHas ? "Yes" : "No",
        systemValue: systemHas ? "Yes" : "No",
      });
    }
  }

  return { conflicts, autoFill };
}
