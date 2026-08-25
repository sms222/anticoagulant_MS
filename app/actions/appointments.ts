"use server";

import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ---------------------------------------------------------------------------
// Scheduling — creates a new appointment on the queue
// ---------------------------------------------------------------------------
export async function createAppointment(formData: FormData) {
  const supabase = createServerClient();
  const { error } = await supabase.from("appointments").insert({
    patient_id: formData.get("patient_id") as string,
    scheduled_date: formData.get("scheduled_date") as string,
    scheduled_time: formData.get("scheduled_time") as string,
    room: (formData.get("room") as string) || null,
    pharmacist_id: (formData.get("pharmacist_id") as string) || null,
    appointment_type: formData.get("appointment_type") as string,
    status: "scheduled",
  });
  if (error) throw new Error("Could not create appointment: " + error.message);
  revalidatePath("/");
  redirect("/");
}

// ---------------------------------------------------------------------------
// Check-in workflow: scheduled -> checked_in -> with_pharmacist -> completed
// (or no_show at any point before completion)
// ---------------------------------------------------------------------------
export async function checkInAppointment(appointmentId: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status: "checked_in", checked_in_at: new Date().toISOString() })
    .eq("id", appointmentId);
  if (error) throw new Error("Could not check in patient: " + error.message);
  revalidatePath("/");
}

export async function startVisit(appointmentId: string, formData: FormData) {
  const supabase = createServerClient();
  const room = formData.get("room") as string;
  const pharmacistId = formData.get("pharmacist_id") as string;
  const { error } = await supabase
    .from("appointments")
    .update({ status: "with_pharmacist", room: room || null, pharmacist_id: pharmacistId || null })
    .eq("id", appointmentId);
  if (error) throw new Error("Could not start visit: " + error.message);
  revalidatePath("/");
}

// Marks the appointment completed and drops a minimal encounter row onto the
// patient's chart (today's date, room, seen-by) so the visit shows up in
// their History immediately. The pharmacist fills in dose/notes/labs from
// the patient chart itself — this is just closing the loop on the queue.
export async function completeAppointment(appointmentId: string) {
  const supabase = createServerClient();
  const { data: appt, error: fetchError } = await supabase
    .from("appointments")
    .select("patient_id, room, pharmacist_id, encounter_id")
    .eq("id", appointmentId)
    .single();
  if (fetchError || !appt) throw new Error("Could not find appointment: " + fetchError?.message);

  const today = new Date().toISOString().slice(0, 10);

  if (appt.encounter_id) {
    await supabase
      .from("encounters")
      .update({ room: appt.room, seen_by: appt.pharmacist_id })
      .eq("id", appt.encounter_id);
  } else {
    const { data: encounter, error: encounterError } = await supabase
      .from("encounters")
      .insert({
        patient_id: appt.patient_id,
        encounter_date: today,
        room: appt.room,
        seen_by: appt.pharmacist_id,
      })
      .select("id")
      .single();
    if (encounterError) throw new Error("Could not log visit: " + encounterError.message);

    await supabase.from("appointments").update({ encounter_id: encounter?.id }).eq("id", appointmentId);
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", appointmentId);
  if (error) throw new Error("Could not mark appointment completed: " + error.message);
  revalidatePath("/");
}

export async function markNoShow(appointmentId: string) {
  const supabase = createServerClient();
  const { error } = await supabase.from("appointments").update({ status: "no_show" }).eq("id", appointmentId);
  if (error) throw new Error("Could not mark no-show: " + error.message);
  revalidatePath("/");
}
