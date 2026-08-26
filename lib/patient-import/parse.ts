import ExcelJS from "exceljs";
import { INDICATION_OPTIONS, COMORBIDITY_OPTIONS } from "@/lib/types";
import type { ParsedInrRow, ParsedPatientSheet } from "./types";

export const NON_PATIENT_SHEET_NAMES = new Set(["Instructions", "Example (filled)", "Example (Filled)"]);

const LABEL_COL = 2; // B
const VALUE_COL = 3; // C

const SEX_MAP: Record<string, "male" | "female"> = { male: "male", female: "female" };
const SMOKING_MAP: Record<string, "never" | "former" | "current"> = {
  "never smoked": "never",
  "former smoker": "former",
  "current smoker": "current",
};
const ANTICOAGULANT_MAP: Record<string, string> = {
  warfarin: "warfarin",
  rivaroxaban: "rivaroxaban",
  apixaban: "apixaban",
  dabigatran: "dabigatran",
  edoxaban: "edoxaban",
  other: "other",
};
const INDICATION_LABEL_TO_VALUE: Record<string, string> = Object.fromEntries(
  INDICATION_OPTIONS.map((o) => [o.label.toLowerCase(), o.value])
);
const COMORBIDITY_SET = new Set(COMORBIDITY_OPTIONS.map((c) => c.toLowerCase()));

function normLabel(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\*/g, "")
    .trim()
    .toLowerCase();
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v !== null && "text" in (v as any)) return String((v as any).text ?? "").trim();
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function toIsoDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (!s) return null;
  // Accept DD/MM/YYYY (as typed by staff) or ISO already
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

const SECTION_HEADERS = [
  "PATIENT DEMOGRAPHICS",
  "CLINICAL",
  "COMORBIDITIES",
  "EMERGENCY CONTACT",
  "NOTES",
  "INR HISTORY",
];

function sectionFor(label: string): string | null {
  const upper = label.toUpperCase();
  for (const h of SECTION_HEADERS) {
    if (upper.startsWith(h)) return h;
  }
  return null;
}

export async function listImportableSheetNames(buffer: ArrayBuffer): Promise<string[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  return wb.worksheets.map((ws) => ws.name).filter((n) => !NON_PATIENT_SHEET_NAMES.has(n));
}

export async function parsePatientSheet(buffer: ArrayBuffer, sheetName: string): Promise<ParsedPatientSheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const ws = wb.getWorksheet(sheetName);

  const errors: string[] = [];
  const result: ParsedPatientSheet = {
    sheetName,
    mrn: null,
    name: null,
    date_of_birth: null,
    sex: null,
    weight_kg: null,
    height_cm: null,
    phone: null,
    address: null,
    ethnicity: null,
    smoking_status: null,
    alcohol_excess: null,
    indication: null,
    indication_detail: null,
    anticoagulant_type: null,
    target_inr: null,
    baseline_creatinine: null,
    comorbidities: [],
    comorbiditiesRecorded: [],
    emergency_contact_info: null,
    notes: null,
    inrRows: [],
    errors,
  };

  if (!ws) {
    errors.push(`Sheet "${sheetName}" not found in the workbook.`);
    return result;
  }

  let currentSection: string | null = null;
  let emergencyLines: string[] = [];
  let inrHeaderRow: number | null = null;
  const rowCount = ws.rowCount;

  for (let r = 1; r <= rowCount; r++) {
    const row = ws.getRow(r);
    const labelRaw = row.getCell(LABEL_COL).value;
    const label = normLabel(labelRaw);
    if (!label) continue;

    const maybeSection = sectionFor(label);
    if (maybeSection) {
      currentSection = maybeSection;
      if (maybeSection === "INR HISTORY") {
        inrHeaderRow = r; // header row for the table follows immediately after this
      }
      continue;
    }

    if (currentSection === "INR HISTORY" && inrHeaderRow !== null && r === inrHeaderRow + 1) {
      // this is the "Date | INR value | Notes" header row of the table — skip it, data starts next row
      continue;
    }

    if (currentSection === "INR HISTORY" && inrHeaderRow !== null && r > inrHeaderRow + 1) {
      const dateVal = row.getCell(LABEL_COL).value;
      const inrVal = row.getCell(LABEL_COL + 1).value;
      const noteVal = row.getCell(LABEL_COL + 2).value;
      const date = toIsoDate(dateVal);
      const value = toNumber(inrVal);
      if (date === null && value === null) continue; // blank row, skip
      if (date === null || value === null) {
        errors.push(`INR history row ${r}: needs both a date and an INR value (one is missing).`);
        continue;
      }
      result.inrRows.push({ date, value, note: cellText(noteVal) || null, rowNumber: r });
      continue;
    }

    const valueRaw = row.getCell(VALUE_COL).value;
    const valueText = cellText(valueRaw);

    if (currentSection === "COMORBIDITIES" && COMORBIDITY_SET.has(label)) {
      const original = COMORBIDITY_OPTIONS.find((c) => c.toLowerCase() === label)!;
      const yn = valueText.toLowerCase();
      if (yn === "yes") {
        result.comorbidities.push(original);
        result.comorbiditiesRecorded.push(original);
      } else if (yn === "no") {
        result.comorbiditiesRecorded.push(original);
      } else if (yn && yn !== "no" && yn !== "yes") {
        errors.push(`Row ${r} ("${original}"): expected Yes or No, got "${valueText}".`);
      }
      continue;
    }

    switch (label) {
      case "mrn":
        result.mrn = valueText || null;
        break;
      case "full name":
        result.name = valueText || null;
        break;
      case "date of birth":
        result.date_of_birth = toIsoDate(valueRaw);
        break;
      case "sex": {
        const key = valueText.toLowerCase();
        if (key) {
          if (SEX_MAP[key]) result.sex = SEX_MAP[key];
          else errors.push(`Sex: unrecognized value "${valueText}" (expected Male or Female).`);
        }
        break;
      }
      case "weight (kg)":
        result.weight_kg = toNumber(valueRaw);
        break;
      case "height (cm)":
        result.height_cm = toNumber(valueRaw);
        break;
      case "phone":
        if (currentSection === "EMERGENCY CONTACT") {
          if (valueText) emergencyLines.push(`Phone: ${valueText}`);
        } else {
          result.phone = valueText || null;
        }
        break;
      case "address":
        result.address = valueText || null;
        break;
      case "ethnicity":
        result.ethnicity = valueText || null;
        break;
      case "smoking status": {
        const key = valueText.toLowerCase();
        if (key) {
          if (SMOKING_MAP[key]) result.smoking_status = SMOKING_MAP[key];
          else errors.push(`Smoking status: unrecognized value "${valueText}".`);
        }
        break;
      }
      case "alcohol excess": {
        const key = valueText.toLowerCase();
        if (key === "yes") result.alcohol_excess = true;
        else if (key === "no") result.alcohol_excess = false;
        else if (key) errors.push(`Alcohol excess: unrecognized value "${valueText}" (expected Yes or No).`);
        break;
      }
      case "indication": {
        const key = valueText.toLowerCase();
        if (key) {
          const mapped = INDICATION_LABEL_TO_VALUE[key];
          if (mapped) result.indication = mapped;
          else errors.push(`Indication: unrecognized value "${valueText}".`);
        }
        break;
      }
      case "indication detail":
        result.indication_detail = valueText || null;
        break;
      case "anticoagulant": {
        const key = valueText.toLowerCase();
        if (key) {
          const mapped = ANTICOAGULANT_MAP[key];
          if (mapped) result.anticoagulant_type = mapped;
          else errors.push(`Anticoagulant: unrecognized value "${valueText}".`);
        }
        break;
      }
      case "target inr":
        result.target_inr = toNumber(valueRaw);
        break;
      case "baseline creatinine (µmol/l)":
      case "baseline creatinine (umol/l)":
        result.baseline_creatinine = toNumber(valueRaw);
        break;
      case "next of kin name":
        if (valueText) emergencyLines.unshift(`Next of kin: ${valueText}`);
        break;
      case "relationship":
        if (valueText) emergencyLines.push(`Relationship: ${valueText}`);
        break;
      case "free text":
        result.notes = valueText || null;
        break;
      default:
        break;
    }
  }

  if (emergencyLines.length) result.emergency_contact_info = emergencyLines.join("\n");

  if (!result.mrn) errors.push("MRN is required and was blank.");
  if (!result.name) errors.push("Full name is required and was blank.");
  if (!result.indication) errors.push("Indication is required and was blank or unrecognized.");
  if (!result.anticoagulant_type) errors.push("Anticoagulant is required and was blank or unrecognized.");
  if (result.indication === "other" && !result.indication_detail) {
    errors.push("Indication is \"Other\" but Indication detail was left blank.");
  }

  return result;
}

export function formatInrRowsForDisplay(rows: ParsedInrRow[]): string {
  return rows.map((r) => `${r.date} — ${r.value}${r.note ? ` (${r.note})` : ""}`).join("\n");
}
