"use server";

import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createPatient(formData: FormData) {
  const supabase = createServerClient();

  const anticoagulantType = formData.get("anticoagulant_type") as string;
  const isWarfarin = anticoagulantType === "warfarin";
  const indication = formData.get("indication") as string;

  // Single target INR value on intake — range is auto-derived (±0.5) rather
  // than asking for low/high separately. See target_inr_history for how
  // later changes get tracked.
  const targetInrRaw = formData.get("target_inr") as string;
  const targetInr = isWarfarin && targetInrRaw ? Number(targetInrRaw) : null;
  const targetInrLow = targetInr !== null ? Math.round((targetInr - 0.5) * 10) / 10 : null;
  const targetInrHigh = targetInr !== null ? Math.round((targetInr + 0.5) * 10) / 10 : null;

  const { data, error } = await supabase
    .from("patients")
    .insert({
      mrn: (formData.get("mrn") as string) || null,
      name: formData.get("name") as string,
      date_of_birth: (formData.get("date_of_birth") as string) || null,
      sex: (formData.get("sex") as string) || null,
      weight_kg: formData.get("weight_kg") ? Number(formData.get("weight_kg")) : null,
      height_cm: formData.get("height_cm") ? Number(formData.get("height_cm")) : null,
      indication,
      indication_detail: indication === "other" ? (formData.get("indication_detail") as string) || null : null,
      anticoagulant_type: anticoagulantType,
      target_inr_low: targetInrLow,
      target_inr_high: targetInrHigh,
      phone: (formData.get("phone") as string) || null,
      address: (formData.get("address") as string) || null,
      notes: (formData.get("notes") as string) || null,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("Could not create patient: " + (error?.message ?? "unknown error"));
  }

  if (targetInr !== null && targetInrLow !== null && targetInrHigh !== null) {
    await supabase.from("target_inr_history").insert({
      patient_id: data.id,
      target_inr: targetInr,
      target_inr_low: targetInrLow,
      target_inr_high: targetInrHigh,
      effective_date: new Date().toISOString().slice(0, 10),
    });
  }

  const weightKg = formData.get("weight_kg") ? Number(formData.get("weight_kg")) : null;
  const heightCm = formData.get("height_cm") ? Number(formData.get("height_cm")) : null;
  if (weightKg !== null || heightCm !== null) {
    await supabase.from("biometrics_history").insert({
      patient_id: data.id,
      weight_kg: weightKg,
      height_cm: heightCm,
      effective_date: new Date().toISOString().slice(0, 10),
    });
  }

  redirect(`/patients/${data.id}`);
}
