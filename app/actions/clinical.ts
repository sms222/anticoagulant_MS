"use server";

import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { todayKL } from "@/lib/datetime";

function path(patientId: string) {
  return `/patients/${patientId}`;
}

// ---------------------------------------------------------------------------
// HAS-BLED / CHA2DS2-VASc auto-recalculation. These run silently after any
// save that touches one of their inputs (comorbidities, alcohol excess,
// target INR, INR labs, active medications) so the score always reflects the
// patient's current variables without a manual click. A new dated row is
// only written when the computed score actually changes from the latest one
// on file — otherwise every routine save would spam identical rows and the
// history would stop meaning "this is when it changed."
// ---------------------------------------------------------------------------
async function recalcHasBled(supabase: ReturnType<typeof createServerClient>, patientId: string) {
  const [{ data: patient }, { data: medications }, { data: inrLabs }, { data: targetHistory }, { data: toolDef }, { data: latest }] =
    await Promise.all([
      supabase
        .from("patients")
        .select("date_of_birth, target_inr_low, target_inr_high, intake_date, comorbidities, alcohol_excess")
        .eq("id", patientId)
        .single(),
      supabase.from("medications").select("drug_name").eq("patient_id", patientId).eq("active", true),
      supabase.from("lab_results").select("result_value, test_date").eq("patient_id", patientId).eq("test_name", "INR"),
      supabase.from("target_inr_history").select("target_inr_low, target_inr_high, effective_date").eq("patient_id", patientId),
      supabase.from("scoring_tool_definitions").select("id").eq("tool_name", "HAS-BLED").single(),
      supabase
        .from("scoring_tool_results")
        .select("score_value, scoring_tool_definitions!inner(tool_name)")
        .eq("patient_id", patientId)
        .eq("scoring_tool_definitions.tool_name", "HAS-BLED")
        .order("score_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  if (!patient || !toolDef) return;

  const { calculateAge } = await import("@/lib/types");
  const { calculateRosendaalTTR } = await import("@/lib/calculators/rosendaal");
  const { calculateHasBled, detectInteractingDrugs, hasBledInputsFromComorbidities } = await import(
    "@/lib/calculators/has-bled"
  );

  const age = calculateAge(patient.date_of_birth);
  const elderly = age !== null && age > 65;

  const ranges =
    (targetHistory ?? []).length > 0
      ? (targetHistory ?? []).map((t) => ({
          from: new Date(t.effective_date),
          low: Number(t.target_inr_low),
          high: Number(t.target_inr_high),
        }))
      : patient.target_inr_low && patient.target_inr_high
      ? [{ from: new Date(patient.intake_date), low: Number(patient.target_inr_low), high: Number(patient.target_inr_high) }]
      : [];

  const readings = (inrLabs ?? []).map((l) => ({ date: new Date(l.test_date), value: Number(l.result_value) }));
  const ttr = ranges.length > 0 ? calculateRosendaalTTR(readings, ranges) : null;
  const labileInr = ttr !== null && readings.length >= 2 && ttr.ttrPercent < 60;

  const interactingDrugs = detectInteractingDrugs((medications ?? []).map((m) => m.drug_name));
  const manualInputs = hasBledInputsFromComorbidities(patient.comorbidities ?? [], patient.alcohol_excess ?? false);
  const result = calculateHasBled(manualInputs, { elderly, labileInr, interactingDrugs });

  if (latest && latest.score_value === result.score) return; // unchanged — don't write a duplicate row

  await supabase.from("scoring_tool_results").insert({
    patient_id: patientId,
    tool_id: toolDef.id,
    score_date: todayKL(),
    score_value: result.score,
    components: result.components,
  });
}

async function recalcCha2ds2Vasc(supabase: ReturnType<typeof createServerClient>, patientId: string) {
  const [{ data: patient }, { data: toolDef }, { data: latest }] = await Promise.all([
    supabase.from("patients").select("date_of_birth, sex, comorbidities").eq("id", patientId).single(),
    supabase.from("scoring_tool_definitions").select("id").eq("tool_name", "CHA2DS2-VASc").single(),
    supabase
      .from("scoring_tool_results")
      .select("score_value, scoring_tool_definitions!inner(tool_name)")
      .eq("patient_id", patientId)
      .eq("scoring_tool_definitions.tool_name", "CHA2DS2-VASc")
      .order("score_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!patient || !toolDef) return;

  const { calculateAge } = await import("@/lib/types");
  const { calculateCha2ds2Vasc, cha2ds2VascFromComorbidities } = await import("@/lib/calculators/cha2ds2-vasc");

  const age = calculateAge(patient.date_of_birth);
  const factors = cha2ds2VascFromComorbidities(patient.comorbidities ?? [], age, patient.sex);
  const result = calculateCha2ds2Vasc(factors);

  if (latest && latest.score_value === result.score) return; // unchanged — don't write a duplicate row

  await supabase.from("scoring_tool_results").insert({
    patient_id: patientId,
    tool_id: toolDef.id,
    score_date: todayKL(),
    score_value: result.score,
    components: result.components,
  });
}

// ---------------------------------------------------------------------------
// Target INR — single value, auto ±0.5 range, tracked as a history so TTR
// reflects whichever range was actually in force on a given day
// ---------------------------------------------------------------------------
export async function updateTargetInr(patientId: string, formData: FormData) {
  const supabase = createServerClient();
  const targetInr = Number(formData.get("target_inr"));
  if (!targetInr || Number.isNaN(targetInr)) throw new Error("Enter a target INR value");
  const targetInrLow = Math.round((targetInr - 0.5) * 10) / 10;
  const targetInrHigh = Math.round((targetInr + 0.5) * 10) / 10;
  const effectiveDate = (formData.get("effective_date") as string) || todayKL();

  const { error: historyError } = await supabase.from("target_inr_history").insert({
    patient_id: patientId,
    target_inr: targetInr,
    target_inr_low: targetInrLow,
    target_inr_high: targetInrHigh,
    effective_date: effectiveDate,
  });
  if (historyError) throw new Error("Could not record target INR change: " + historyError.message);

  const { error: patientError } = await supabase
    .from("patients")
    .update({ target_inr_low: targetInrLow, target_inr_high: targetInrHigh })
    .eq("id", patientId);
  if (patientError) throw new Error("Could not update patient's current target: " + patientError.message);

  await recalcHasBled(supabase, patientId);
  revalidatePath(path(patientId));
}

// ---------------------------------------------------------------------------
// Biometrics (weight/height) — tracked over time, same pattern as target INR
// ---------------------------------------------------------------------------
export async function updateBiometrics(patientId: string, formData: FormData) {
  const supabase = createServerClient();
  const weightKg = formData.get("weight_kg") ? Number(formData.get("weight_kg")) : null;
  const heightCm = formData.get("height_cm") ? Number(formData.get("height_cm")) : null;
  const effectiveDate = (formData.get("effective_date") as string) || todayKL();

  if (weightKg === null && heightCm === null) throw new Error("Enter a weight or height");

  const { error: historyError } = await supabase.from("biometrics_history").insert({
    patient_id: patientId,
    weight_kg: weightKg,
    height_cm: heightCm,
    effective_date: effectiveDate,
  });
  if (historyError) throw new Error("Could not record biometrics: " + historyError.message);

  const update: Record<string, number> = {};
  if (weightKg !== null) update.weight_kg = weightKg;
  if (heightCm !== null) update.height_cm = heightCm;
  const { error: patientError } = await supabase.from("patients").update(update).eq("id", patientId);
  if (patientError) throw new Error("Could not update patient's current biometrics: " + patientError.message);

  revalidatePath(path(patientId));
}

// ---------------------------------------------------------------------------
// Patient notes — general free text (links can just be pasted in as text)
// ---------------------------------------------------------------------------
export async function updatePatientNotes(patientId: string, formData: FormData) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("patients")
    .update({ notes: (formData.get("notes") as string) || null })
    .eq("id", patientId);
  if (error) throw new Error("Could not save notes: " + error.message);
  revalidatePath(path(patientId));
}

// ---------------------------------------------------------------------------
// Patient details — everything editable except name / MRN / DOB (backend-only,
// identity fields; changing those goes through whoever administers the DB)
// ---------------------------------------------------------------------------
export async function updatePatientDetails(patientId: string, formData: FormData) {
  const supabase = createServerClient();
  const indication = formData.get("indication") as string;
  const { error } = await supabase
    .from("patients")
    .update({
      mrn: (formData.get("mrn") as string) || null,
      phone: (formData.get("phone") as string) || null,
      address: (formData.get("address") as string) || null,
      indication,
      indication_detail: indication === "other" ? (formData.get("indication_detail") as string) || null : null,
      anticoagulant_type: formData.get("anticoagulant_type") as string,
      intake_date: (formData.get("intake_date") as string) || undefined,
    })
    .eq("id", patientId);
  if (error) throw new Error("Could not update patient details: " + error.message);
  revalidatePath(path(patientId));
}

// ---------------------------------------------------------------------------
// Lab results — add / edit / delete
// ---------------------------------------------------------------------------
export async function addLabResult(patientId: string, formData: FormData) {
  const supabase = createServerClient();
  const testName = formData.get("test_name") as string;
  const { error } = await supabase.from("lab_results").insert({
    patient_id: patientId,
    test_name: testName,
    result_value: Number(formData.get("result_value")),
    unit: (formData.get("unit") as string) || null,
    test_date: (formData.get("test_date") as string) || todayKL(),
    source: "manual",
  });
  if (error) throw new Error("Could not add lab result: " + error.message);
  if (testName === "INR") await recalcHasBled(supabase, patientId);
  revalidatePath(path(patientId));
}

export async function updateLabResult(patientId: string, labId: string, formData: FormData) {
  const supabase = createServerClient();
  const testName = formData.get("test_name") as string;
  const { error } = await supabase
    .from("lab_results")
    .update({
      test_name: testName,
      result_value: Number(formData.get("result_value")),
      unit: (formData.get("unit") as string) || null,
      test_date: formData.get("test_date") as string,
    })
    .eq("id", labId);
  if (error) throw new Error("Could not update lab result: " + error.message);
  if (testName === "INR") await recalcHasBled(supabase, patientId);
  revalidatePath(path(patientId));
}

export async function deleteLabResult(patientId: string, labId: string) {
  const supabase = createServerClient();
  const { data: lab } = await supabase.from("lab_results").select("test_name").eq("id", labId).single();
  const { error } = await supabase.from("lab_results").delete().eq("id", labId);
  if (error) throw new Error("Could not delete lab result: " + error.message);
  if (lab?.test_name === "INR") await recalcHasBled(supabase, patientId);
  revalidatePath(path(patientId));
}

// ---------------------------------------------------------------------------
// Encounters (visits) — add / edit. Dose, room, next appt, notes are the
// fields a pharmacist actually fills in at a visit.
// ---------------------------------------------------------------------------
export async function addEncounter(patientId: string, formData: FormData) {
  const supabase = createServerClient();
  const { error } = await supabase.from("encounters").insert({
    patient_id: patientId,
    encounter_date: (formData.get("encounter_date") as string) || todayKL(),
    current_dose_mg: formData.get("current_dose_mg") ? Number(formData.get("current_dose_mg")) : null,
    room: (formData.get("room") as string) || null,
    next_appt_date: (formData.get("next_appt_date") as string) || null,
    notes: (formData.get("notes") as string) || null,
    seen_by: (formData.get("seen_by") as string) || null,
  });
  if (error) throw new Error("Could not add visit: " + error.message);
  revalidatePath(path(patientId));
}

export async function updateEncounter(patientId: string, encounterId: string, formData: FormData) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("encounters")
    .update({
      encounter_date: formData.get("encounter_date") as string,
      current_dose_mg: formData.get("current_dose_mg") ? Number(formData.get("current_dose_mg")) : null,
      room: (formData.get("room") as string) || null,
      next_appt_date: (formData.get("next_appt_date") as string) || null,
      notes: (formData.get("notes") as string) || null,
      seen_by: (formData.get("seen_by") as string) || null,
    })
    .eq("id", encounterId);
  if (error) throw new Error("Could not update visit: " + error.message);
  revalidatePath(path(patientId));
}

// ---------------------------------------------------------------------------
// HAS-BLED / CHA2DS2-VASc — the score is never entered directly, and now
// recalculates automatically whenever an input changes (see recalcHasBled /
// recalcCha2ds2Vasc above, wired into updatePatientRiskFactors, updateTargetInr,
// lab-result actions, and medication actions below). These "Recalculate now"
// buttons stay as a manual fallback that always writes a fresh dated entry,
// even if the score hasn't moved — useful to confirm the score is current as
// of today without needing to change anything first.
// ---------------------------------------------------------------------------
export async function addHasBledAssessment(patientId: string) {
  const supabase = createServerClient();

  const [{ data: patient }, { data: medications }, { data: inrLabs }, { data: targetHistory }, { data: toolDef }] =
    await Promise.all([
      supabase
        .from("patients")
        .select("date_of_birth, target_inr_low, target_inr_high, intake_date, comorbidities, alcohol_excess")
        .eq("id", patientId)
        .single(),
      supabase.from("medications").select("drug_name").eq("patient_id", patientId).eq("active", true),
      supabase.from("lab_results").select("result_value, test_date").eq("patient_id", patientId).eq("test_name", "INR"),
      supabase.from("target_inr_history").select("target_inr_low, target_inr_high, effective_date").eq("patient_id", patientId),
      supabase.from("scoring_tool_definitions").select("id").eq("tool_name", "HAS-BLED").single(),
    ]);

  if (!patient || !toolDef) throw new Error("Could not load patient or HAS-BLED tool definition");

  const { calculateAge } = await import("@/lib/types");
  const { calculateRosendaalTTR } = await import("@/lib/calculators/rosendaal");
  const { calculateHasBled, detectInteractingDrugs, hasBledInputsFromComorbidities } = await import(
    "@/lib/calculators/has-bled"
  );

  const age = calculateAge(patient.date_of_birth);
  const elderly = age !== null && age > 65;

  const ranges =
    (targetHistory ?? []).length > 0
      ? (targetHistory ?? []).map((t) => ({
          from: new Date(t.effective_date),
          low: Number(t.target_inr_low),
          high: Number(t.target_inr_high),
        }))
      : patient.target_inr_low && patient.target_inr_high
      ? [{ from: new Date(patient.intake_date), low: Number(patient.target_inr_low), high: Number(patient.target_inr_high) }]
      : [];

  const readings = (inrLabs ?? []).map((l) => ({ date: new Date(l.test_date), value: Number(l.result_value) }));
  const ttr = ranges.length > 0 ? calculateRosendaalTTR(readings, ranges) : null;
  const labileInr = ttr !== null && readings.length >= 2 && ttr.ttrPercent < 60;

  const interactingDrugs = detectInteractingDrugs((medications ?? []).map((m) => m.drug_name));
  const manualInputs = hasBledInputsFromComorbidities(patient.comorbidities ?? [], patient.alcohol_excess ?? false);

  const result = calculateHasBled(manualInputs, { elderly, labileInr, interactingDrugs });

  const { error } = await supabase.from("scoring_tool_results").insert({
    patient_id: patientId,
    tool_id: toolDef.id,
    score_date: todayKL(),
    score_value: result.score,
    components: result.components,
  });
  if (error) throw new Error("Could not save HAS-BLED assessment: " + error.message);
  revalidatePath(path(patientId));
}

// ---------------------------------------------------------------------------
// CHA2DS2-VASc — same pattern: computed entirely from comorbidities + DOB +
// sex, nothing asked directly.
// ---------------------------------------------------------------------------
export async function addCha2ds2VascAssessment(patientId: string) {
  const supabase = createServerClient();

  const [{ data: patient }, { data: toolDef }] = await Promise.all([
    supabase.from("patients").select("date_of_birth, sex, comorbidities").eq("id", patientId).single(),
    supabase.from("scoring_tool_definitions").select("id").eq("tool_name", "CHA2DS2-VASc").single(),
  ]);
  if (!patient || !toolDef) throw new Error("Could not load patient or CHA2DS2-VASc tool definition");

  const { calculateAge } = await import("@/lib/types");
  const { calculateCha2ds2Vasc, cha2ds2VascFromComorbidities } = await import("@/lib/calculators/cha2ds2-vasc");

  const age = calculateAge(patient.date_of_birth);
  const factors = cha2ds2VascFromComorbidities(patient.comorbidities ?? [], age, patient.sex);
  const result = calculateCha2ds2Vasc(factors);

  const { error } = await supabase.from("scoring_tool_results").insert({
    patient_id: patientId,
    tool_id: toolDef.id,
    score_date: todayKL(),
    score_value: result.score,
    components: result.components,
  });
  if (error) throw new Error("Could not save CHA2DS2-VASc assessment: " + error.message);
  revalidatePath(path(patientId));
}

// ---------------------------------------------------------------------------
// Demographics/risk-factor fields — ethnicity, smoking, comorbidities,
// alcohol excess. Separate from updatePatientDetails so this panel can save
// independently. Comorbidities/alcohol feed both HAS-BLED and CHA2DS2-VASc
// directly, so both auto-recalculate here.
// ---------------------------------------------------------------------------
export async function updatePatientRiskFactors(patientId: string, formData: FormData) {
  const supabase = createServerClient();
  const comorbidities = formData.getAll("comorbidities") as string[];
  const { error } = await supabase
    .from("patients")
    .update({
      ethnicity: (formData.get("ethnicity") as string) || null,
      smoking_status: (formData.get("smoking_status") as string) || null,
      comorbidities,
      alcohol_excess: formData.get("alcohol_excess") === "on",
    })
    .eq("id", patientId);
  if (error) throw new Error("Could not update risk factors: " + error.message);
  await Promise.all([recalcHasBled(supabase, patientId), recalcCha2ds2Vasc(supabase, patientId)]);
  revalidatePath(path(patientId));
}

// ---------------------------------------------------------------------------
// Contacts — single free-text field on patients
// ---------------------------------------------------------------------------
export async function updateEmergencyContact(patientId: string, formData: FormData) {
  const supabase = createServerClient();
  const content = (formData.get("emergency_contact_info") as string) ?? "";
  const { error } = await supabase
    .from("patients")
    .update({ emergency_contact_info: content })
    .eq("id", patientId);
  if (error) throw new Error("Could not save contact info: " + error.message);
  revalidatePath(path(patientId));
}

// ---------------------------------------------------------------------------
// Drugs — structured medication list
// ---------------------------------------------------------------------------
export async function addMedication(patientId: string, formData: FormData) {
  const supabase = createServerClient();
  const { error } = await supabase.from("medications").insert({
    patient_id: patientId,
    drug_name: formData.get("drug_name") as string,
    dose: formData.get("dose") as string,
    frequency: formData.get("frequency") as string,
    route: (formData.get("route") as string) || null,
    indication: (formData.get("indication") as string) || null,
    start_date: (formData.get("start_date") as string) || todayKL(),
    notes: (formData.get("notes") as string) || null,
  });
  if (error) throw new Error("Could not add medication: " + error.message);
  await recalcHasBled(supabase, patientId);
  revalidatePath(path(patientId));
}

export async function updateMedication(patientId: string, medicationId: string, formData: FormData) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("medications")
    .update({
      drug_name: formData.get("drug_name") as string,
      dose: formData.get("dose") as string,
      frequency: formData.get("frequency") as string,
      route: (formData.get("route") as string) || null,
      indication: (formData.get("indication") as string) || null,
      start_date: formData.get("start_date") as string,
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", medicationId);
  if (error) throw new Error("Could not update medication: " + error.message);
  await recalcHasBled(supabase, patientId);
  revalidatePath(path(patientId));
}

export async function discontinueMedication(patientId: string, medicationId: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("medications")
    .update({ active: false, stop_date: todayKL() })
    .eq("id", medicationId);
  if (error) throw new Error("Could not discontinue medication: " + error.message);
  await recalcHasBled(supabase, patientId);
  revalidatePath(path(patientId));
}

export async function deleteMedication(patientId: string, medicationId: string) {
  const supabase = createServerClient();
  const { error } = await supabase.from("medications").delete().eq("id", medicationId);
  if (error) throw new Error("Could not delete medication: " + error.message);
  await recalcHasBled(supabase, patientId);
  revalidatePath(path(patientId));
}

// ---------------------------------------------------------------------------
// Events — wired to existing clinical_events table
// ---------------------------------------------------------------------------
export async function addClinicalEvent(patientId: string, formData: FormData) {
  const supabase = createServerClient();
  const eventType = formData.get("event_type") as string;
  const { error } = await supabase.from("clinical_events").insert({
    patient_id: patientId,
    event_type: eventType,
    bleeding_severity: eventType === "bleeding" ? (formData.get("bleeding_severity") as string) || null : null,
    event_date: (formData.get("event_date") as string) || todayKL(),
    description: formData.get("description") as string,
    inr_at_event: formData.get("inr_at_event") ? Number(formData.get("inr_at_event")) : null,
    outcome: (formData.get("outcome") as string) || null,
  });
  if (error) throw new Error("Could not add event: " + error.message);
  revalidatePath(path(patientId));
}

export async function deleteClinicalEvent(patientId: string, eventId: string) {
  const supabase = createServerClient();
  const { error } = await supabase.from("clinical_events").delete().eq("id", eventId);
  if (error) throw new Error("Could not delete event: " + error.message);
  revalidatePath(path(patientId));
}

export async function updateClinicalEvent(patientId: string, eventId: string, formData: FormData) {
  const supabase = createServerClient();
  const eventType = formData.get("event_type") as string;
  const { error } = await supabase
    .from("clinical_events")
    .update({
      event_type: eventType,
      bleeding_severity: eventType === "bleeding" ? (formData.get("bleeding_severity") as string) || null : null,
      event_date: formData.get("event_date") as string,
      description: formData.get("description") as string,
      inr_at_event: formData.get("inr_at_event") ? Number(formData.get("inr_at_event")) : null,
      outcome: (formData.get("outcome") as string) || null,
    })
    .eq("id", eventId);
  if (error) throw new Error("Could not update event: " + error.message);
  revalidatePath(path(patientId));
}

// ---------------------------------------------------------------------------
// Reminders — freeform per-patient task list
// ---------------------------------------------------------------------------
export async function addReminder(patientId: string, formData: FormData) {
  const supabase = createServerClient();
  const { error } = await supabase.from("reminders").insert({
    patient_id: patientId,
    task: formData.get("task") as string,
    due_date: (formData.get("due_date") as string) || null,
  });
  if (error) throw new Error("Could not add reminder: " + error.message);
  revalidatePath(path(patientId));
}

export async function toggleReminder(patientId: string, reminderId: string, completed: boolean) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("reminders")
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", reminderId);
  if (error) throw new Error("Could not update reminder: " + error.message);
  revalidatePath(path(patientId));
}

export async function deleteReminder(patientId: string, reminderId: string) {
  const supabase = createServerClient();
  const { error } = await supabase.from("reminders").delete().eq("id", reminderId);
  if (error) throw new Error("Could not delete reminder: " + error.message);
  revalidatePath(path(patientId));
}

export async function updateReminder(patientId: string, reminderId: string, formData: FormData) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("reminders")
    .update({
      task: formData.get("task") as string,
      due_date: (formData.get("due_date") as string) || null,
    })
    .eq("id", reminderId);
  if (error) throw new Error("Could not update reminder: " + error.message);
  revalidatePath(path(patientId));
}

// ---------------------------------------------------------------------------
// Documents — link/metadata list, no file bytes stored
// ---------------------------------------------------------------------------
export async function addPatientDocument(patientId: string, formData: FormData) {
  const supabase = createServerClient();
  const { error } = await supabase.from("patient_documents").insert({
    patient_id: patientId,
    label: formData.get("label") as string,
    url: formData.get("url") as string,
  });
  if (error) throw new Error("Could not add document link: " + error.message);
  revalidatePath(path(patientId));
}

export async function deletePatientDocument(patientId: string, documentId: string) {
  const supabase = createServerClient();
  const { error } = await supabase.from("patient_documents").delete().eq("id", documentId);
  if (error) throw new Error("Could not delete document link: " + error.message);
  revalidatePath(path(patientId));
}
