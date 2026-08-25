"use server";

import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function path(patientId: string) {
  return `/patients/${patientId}`;
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
  const effectiveDate = (formData.get("effective_date") as string) || new Date().toISOString().slice(0, 10);

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
    start_date: (formData.get("start_date") as string) || new Date().toISOString().slice(0, 10),
    notes: (formData.get("notes") as string) || null,
  });
  if (error) throw new Error("Could not add medication: " + error.message);
  revalidatePath(path(patientId));
}

export async function discontinueMedication(patientId: string, medicationId: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("medications")
    .update({ active: false, stop_date: new Date().toISOString().slice(0, 10) })
    .eq("id", medicationId);
  if (error) throw new Error("Could not discontinue medication: " + error.message);
  revalidatePath(path(patientId));
}

export async function deleteMedication(patientId: string, medicationId: string) {
  const supabase = createServerClient();
  const { error } = await supabase.from("medications").delete().eq("id", medicationId);
  if (error) throw new Error("Could not delete medication: " + error.message);
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
    event_date: (formData.get("event_date") as string) || new Date().toISOString().slice(0, 10),
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
