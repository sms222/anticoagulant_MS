// Shared types for the paper-to-ACMS Excel migration import.
// Parsing lives in parse.ts (pure, no DB access). Diffing against the
// database and the actual writes live in app/actions/patient-import.ts.

export interface ParsedInrRow {
  date: string | null; // ISO yyyy-mm-dd
  value: number | null;
  note: string | null;
  rowNumber: number; // 1-indexed row in the sheet, for error messages
}

export interface ParsedPatientSheet {
  sheetName: string;
  mrn: string | null;
  name: string | null;
  date_of_birth: string | null;
  sex: "male" | "female" | null;
  weight_kg: number | null;
  height_cm: number | null;
  phone: string | null;
  address: string | null;
  ethnicity: string | null;
  smoking_status: "never" | "former" | "current" | null;
  alcohol_excess: boolean | null; // null = blank on sheet = "not recorded"
  indication: string | null; // internal value key, e.g. "af_nonvalvular"
  indication_detail: string | null;
  anticoagulant_type: string | null; // internal value key, e.g. "warfarin"
  target_inr: number | null;
  baseline_creatinine: number | null;
  comorbidities: string[]; // only comorbidities marked "Yes" on the sheet
  comorbiditiesRecorded: string[]; // comorbidities that had ANY answer (Yes or No) — used to know what was "not recorded"
  emergency_contact_info: string | null;
  notes: string | null;
  inrRows: ParsedInrRow[];
  errors: string[]; // hard problems (missing required field, unrecognized dropdown value, etc.)
}

// A single patients-table field that differs between the sheet and the
// database, and needs a human decision.
export interface FieldConflict {
  field: string; // key into ParsedPatientSheet / patients row
  label: string; // human label for the UI
  sheetValue: string; // display string
  systemValue: string; // display string
}

// A field where the sheet had a value and the system had nothing — applied
// automatically, just shown to the user as a heads-up, not a decision.
export interface AutoFillField {
  field: string;
  label: string;
  value: string;
}

export type ImportMode = "new" | "existing";

export interface ImportPreview {
  mode: ImportMode;
  existingPatientId: string | null;
  parsed: ParsedPatientSheet;
  conflicts: FieldConflict[];
  autoFill: AutoFillField[];
  inrRowCount: number;
  errors: string[];
}
