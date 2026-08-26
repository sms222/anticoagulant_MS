"use server";

import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { listImportableSheetNames, parsePatientSheet, NON_PATIENT_SHEET_NAMES } from "@/lib/patient-import/parse";
import { computeDiff, type ExistingPatientRow } from "@/lib/patient-import/diff";
import type { ImportPreview } from "@/lib/patient-import/types";
import { addHasBledAssessment, addCha2ds2VascAssessment } from "@/app/actions/clinical";

export type PreviewResult =
  | { needsSheetSelection: true; sheets: string[] }
  | { needsSheetSelection: false; preview: ImportPreview };

async function fileToBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

export async function previewPatientImport(formData: FormData): Promise<PreviewResult> {
  const file = formData.get("file") as File | null;
  const chosenSheet = (formData.get("sheet") as string) || null;
  if (!file || file.size === 0) throw new Error("No file uploaded.");

  const buffer = await fileToBuffer(file);
  const sheets = await listImportableSheetNames(buffer);

  if (sheets.length === 0) {
    throw new Error(
      'No patient tabs found in this workbook (only "Instructions" / "Example (filled)" tabs, or none at all).'
    );
  }

  let sheetName = chosenSheet;
  if (!sheetName) {
    if (sheets.length > 1) {
      return { needsSheetSelection: true, sheets };
    }
    sheetName = sheets[0];
  }
  if (NON_PATIENT_SHEET_NAMES.has(sheetName)) {
    throw new Error(`"${sheetName}" is a template/example tab, not a patient tab.`);
  }

  const parsed = await parsePatientSheet(buffer, sheetName);

  const supabase = createServerClient();
  let existingPatientId: string | null = null;
  let existing: ExistingPatientRow | null = null;

  if (parsed.mrn) {
    const { data } = await supabase
      .from("patients")
      .select(
        "id, name, date_of_birth, sex, weight_kg, height_cm, phone, address, ethnicity, smoking_status, alcohol_excess, indication, indication_detail, anticoagulant_type, target_inr_low, baseline_creatinine, comorbidities, emergency_contact_info, notes"
      )
      .eq("mrn", parsed.mrn)
      .maybeSingle();
    if (data) {
      existingPatientId = data.id;
      existing = data as unknown as ExistingPatientRow;
    }
  }

  const { conflicts, autoFill } = computeDiff(parsed, existing);

  const preview: ImportPreview = {
    mode: existingPatientId ? "existing" : "new",
    existingPatientId,
    parsed,
    conflicts,
    autoFill,
    inrRowCount: parsed.inrRows.length,
    errors: parsed.errors,
  };

  return { needsSheetSelection: false, preview };
}

export interface CommitImportInput {
  mode: "new" | "existing";
  existingPatientId: string | null;
  parsed: ImportPreview["parsed"];
  resolutions: Record<string, "sheet" | "system">; // keyed by conflict.field
  conflicts: ImportPreview["conflicts"];
}

export async function commitPatientImport(input: CommitImportInput): Promise<{ patientId: string }> {
  const { mode, existingPatientId, parsed, resolutions, conflicts } = input;
  const supabase = createServerClient();

  if (parsed.errors.length > 0) {
    throw new Error("This sheet has unresolved errors and cannot be imported: " + parsed.errors.join("; "));
  }

  const conflictByField = new Map(conflicts.map((c) => [c.field, c]));

  function resolvedScalar<T>(field: string, sheetValue: T | null, isNewPatient: boolean): T | undefined {
    if (sheetValue === null || sheetValue === undefined || sheetValue === "") return undefined; // blank never overwrites
    if (isNewPatient) return sheetValue;
    const conflict = conflictByField.get(field);
    if (!conflict) return sheetValue; // no conflict recorded -> either autofill or identical, either way safe to write
    return resolutions[field] === "system" ? undefined : sheetValue; // "system" = no-op, "sheet" = apply
  }

  let patientId: string;

  if (mode === "new") {
    const targetInrLow = parsed.target_inr !== null ? Math.round((parsed.target_inr - 0.5) * 10) / 10 : null;
    const targetInrHigh = parsed.target_inr !== null ? Math.round((parsed.target_inr + 0.5) * 10) / 10 : null;

    const { data, error } = await supabase
      .from("patients")
      .insert({
        mrn: parsed.mrn,
        name: parsed.name,
        date_of_birth: parsed.date_of_birth,
        sex: parsed.sex,
        weight_kg: parsed.weight_kg,
        height_cm: parsed.height_cm,
        phone: parsed.phone,
        address: parsed.address,
        ethnicity: parsed.ethnicity,
        smoking_status: parsed.smoking_status,
        alcohol_excess: parsed.alcohol_excess ?? false,
        indication: parsed.indication,
        indication_detail: parsed.indication_detail,
        anticoagulant_type: parsed.anticoagulant_type,
        target_inr_low: targetInrLow,
        target_inr_high: targetInrHigh,
        baseline_creatinine: parsed.baseline_creatinine,
        comorbidities: parsed.comorbidities,
        emergency_contact_info: parsed.emergency_contact_info,
        notes: parsed.notes,
        status: "active",
        intake_date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (error || !data) throw new Error("Could not create patient: " + (error?.message ?? "unknown error"));
    patientId = data.id;

    if (targetInrLow !== null && targetInrHigh !== null && parsed.target_inr !== null) {
      await supabase.from("target_inr_history").insert({
        patient_id: patientId,
        target_inr: parsed.target_inr,
        target_inr_low: targetInrLow,
        target_inr_high: targetInrHigh,
        effective_date: new Date().toISOString().slice(0, 10),
      });
    }
    if (parsed.weight_kg !== null || parsed.height_cm !== null) {
      await supabase.from("biometrics_history").insert({
        patient_id: patientId,
        weight_kg: parsed.weight_kg,
        height_cm: parsed.height_cm,
        effective_date: new Date().toISOString().slice(0, 10),
      });
    }
  } else {
    if (!existingPatientId) throw new Error("Existing patient id missing for an update-mode import.");
    patientId = existingPatientId;

    // fetch current comorbidities/target so per-item resolution has a base to start from
    const { data: current } = await supabase
      .from("patients")
      .select("comorbidities, target_inr_low")
      .eq("id", patientId)
      .single();

    const update: Record<string, unknown> = {};
    const setIfResolved = (field: string, sheetValue: unknown) => {
      const v = resolvedScalar(field, sheetValue as never, false);
      if (v !== undefined) update[field] = v;
    };
    setIfResolved("name", parsed.name);
    setIfResolved("date_of_birth", parsed.date_of_birth);
    setIfResolved("sex", parsed.sex);
    setIfResolved("weight_kg", parsed.weight_kg);
    setIfResolved("height_cm", parsed.height_cm);
    setIfResolved("phone", parsed.phone);
    setIfResolved("address", parsed.address);
    setIfResolved("ethnicity", parsed.ethnicity);
    setIfResolved("smoking_status", parsed.smoking_status);
    setIfResolved("alcohol_excess", parsed.alcohol_excess);
    setIfResolved("baseline_creatinine", parsed.baseline_creatinine);
    setIfResolved("emergency_contact_info", parsed.emergency_contact_info);
    setIfResolved("notes", parsed.notes);
    if (parsed.indication) {
      const v = resolvedScalar("indication", parsed.indication, false);
      if (v !== undefined) {
        update.indication = v;
        update.indication_detail = parsed.indication === "other" ? parsed.indication_detail : null;
      }
    }
    setIfResolved("anticoagulant_type", parsed.anticoagulant_type);

    // comorbidities: per-item resolution, base = current system list
    const comorbSet = new Set<string>(current?.comorbidities ?? []);
    for (const c of parsed.comorbiditiesRecorded) {
      const field = `comorbidity:${c}`;
      const sheetHas = parsed.comorbidities.includes(c);
      const conflict = conflictByField.get(field);
      if (!conflict) {
        if (sheetHas) comorbSet.add(c);
        else comorbSet.delete(c);
      } else if (resolutions[field] === "sheet") {
        if (sheetHas) comorbSet.add(c);
        else comorbSet.delete(c);
      } // "system" -> leave as-is
    }
    update.comorbidities = Array.from(comorbSet);

    if (Object.keys(update).length > 0) {
      const { error } = await supabase.from("patients").update(update).eq("id", patientId);
      if (error) throw new Error("Could not update patient: " + error.message);
    }

    // target INR: resolved like any other field, but writes to target_inr_history too
    const targetConflict = conflictByField.get("target_inr");
    const applyTarget =
      parsed.target_inr !== null && (!targetConflict || resolutions["target_inr"] === "sheet");
    if (applyTarget) {
      const targetInrLow = Math.round((parsed.target_inr! - 0.5) * 10) / 10;
      const targetInrHigh = Math.round((parsed.target_inr! + 0.5) * 10) / 10;
      await supabase.from("target_inr_history").insert({
        patient_id: patientId,
        target_inr: parsed.target_inr,
        target_inr_low: targetInrLow,
        target_inr_high: targetInrHigh,
        effective_date: new Date().toISOString().slice(0, 10),
      });
      await supabase.from("patients").update({ target_inr_low: targetInrLow, target_inr_high: targetInrHigh }).eq("id", patientId);
    }

    if (parsed.weight_kg !== null || parsed.height_cm !== null) {
      const weightApplied = resolvedScalar("weight_kg", parsed.weight_kg, false) !== undefined;
      const heightApplied = resolvedScalar("height_cm", parsed.height_cm, false) !== undefined;
      if (weightApplied || heightApplied) {
        await supabase.from("biometrics_history").insert({
          patient_id: patientId,
          weight_kg: weightApplied ? parsed.weight_kg : null,
          height_cm: heightApplied ? parsed.height_cm : null,
          effective_date: new Date().toISOString().slice(0, 10),
        });
      }
    }
  }

  // INR history — always appended, repeats allowed, never diffed (Min's call).
  if (parsed.inrRows.length > 0) {
    const rows = parsed.inrRows.map((r) => ({
      patient_id: patientId,
      test_name: "INR",
      result_value: r.value,
      unit: null,
      test_date: r.date,
      source: "manual" as const,
      notes: r.note,
    }));
    const { error } = await supabase.from("lab_results").insert(rows);
    if (error) throw new Error("Could not insert INR history: " + error.message);
  }

  await Promise.all([addHasBledAssessment(patientId), addCha2ds2VascAssessment(patientId)]);

  revalidatePath(`/patients/${patientId}`);
  revalidatePath("/patients/new");
  return { patientId };
}
