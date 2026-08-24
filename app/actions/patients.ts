"use server";

import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createPatient(formData: FormData) {
  const supabase = createServerClient();

  const anticoagulantType = formData.get("anticoagulant_type") as string;
  const isWarfarin = anticoagulantType === "warfarin";

  const { data, error } = await supabase
    .from("patients")
    .insert({
      name: formData.get("name") as string,
      date_of_birth: (formData.get("date_of_birth") as string) || null,
      sex: (formData.get("sex") as string) || null,
      weight_kg: formData.get("weight_kg") ? Number(formData.get("weight_kg")) : null,
      height_cm: formData.get("height_cm") ? Number(formData.get("height_cm")) : null,
      indication: formData.get("indication") as string,
      anticoagulant_type: anticoagulantType,
      target_inr_low: isWarfarin && formData.get("target_inr_low") ? Number(formData.get("target_inr_low")) : null,
      target_inr_high: isWarfarin && formData.get("target_inr_high") ? Number(formData.get("target_inr_high")) : null,
      phone: (formData.get("phone") as string) || null,
      address: (formData.get("address") as string) || null,
      risk_class: (formData.get("risk_class") as string) || null,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("Could not create patient: " + (error?.message ?? "unknown error"));
  }

  redirect(`/patients/${data.id}`);
}
