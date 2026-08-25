import { createServerClient } from "./server";
import type {
  Patient,
  Encounter,
  LabResult,
  ScoringResult,
  ClinicalEvent,
  Medication,
  Reminder,
  TargetInrHistoryEntry,
  BiometricsHistoryEntry,
  FollowUpStatus,
  Pharmacist,
  TodaysAppointment,
} from "@/lib/types";

export async function getPatient(id: string): Promise<Patient | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Patient;
}

export async function getEncounters(patientId: string): Promise<Encounter[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("encounters")
    .select("*, profiles(full_name)")
    .eq("patient_id", patientId)
    .order("encounter_date", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row: any) => ({
    ...row,
    seen_by_name: row.profiles?.full_name ?? null,
  })) as Encounter[];
}

export async function getLabResults(
  patientId: string,
  testName?: string
): Promise<LabResult[]> {
  const supabase = createServerClient();
  let query = supabase
    .from("lab_results")
    .select("*")
    .eq("patient_id", patientId)
    .order("test_date", { ascending: true });
  if (testName) query = query.eq("test_name", testName);
  const { data, error } = await query;
  if (error) return [];
  return data as LabResult[];
}

export async function getScoringResults(
  patientId: string,
  toolName: string
): Promise<ScoringResult[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("scoring_tool_results")
    .select("id, patient_id, score_date, score_value, components, scoring_tool_definitions(tool_name)")
    .eq("patient_id", patientId)
    .eq("scoring_tool_definitions.tool_name", toolName)
    .order("score_date", { ascending: true });
  if (error) return [];
  return (data ?? []).map((row: any) => ({
    id: row.id,
    patient_id: row.patient_id,
    score_date: row.score_date,
    score_value: row.score_value,
    tool_name: row.scoring_tool_definitions?.tool_name ?? toolName,
    components: row.components ?? null,
  }));
}

export async function getTodaysAppointments(): Promise<TodaysAppointment[]> {
  const supabase = createServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, patient_id, scheduled_time, room, status, appointment_type, pharmacist_id, patients(name, anticoagulant_type, target_inr_low, target_inr_high), profiles(full_name)"
    )
    .eq("scheduled_date", today)
    .order("scheduled_time", { ascending: true });
  if (error) return [];

  const patientIds = (data ?? []).map((row: any) => row.patient_id);
  const { data: inrRows } = await supabase
    .from("patient_latest_inr")
    .select("patient_id, last_inr")
    .in("patient_id", patientIds.length > 0 ? patientIds : ["00000000-0000-0000-0000-000000000000"]);
  const inrByPatient = new Map((inrRows ?? []).map((r: any) => [r.patient_id, Number(r.last_inr)]));

  return (data ?? []).map((row: any) => ({
    id: row.id,
    patient_id: row.patient_id,
    scheduled_time: row.scheduled_time,
    room: row.room,
    status: row.status,
    appointment_type: row.appointment_type,
    pharmacist_id: row.pharmacist_id,
    pharmacist_name: row.profiles?.full_name ?? null,
    patient_name: row.patients?.name ?? "Unknown",
    anticoagulant_type: row.patients?.anticoagulant_type ?? "",
    target_inr_low: row.patients?.target_inr_low ?? null,
    target_inr_high: row.patients?.target_inr_high ?? null,
    last_inr: inrByPatient.get(row.patient_id) ?? null,
  }));
}

export async function getHighInrAlerts(): Promise<{ patient_id: string; name: string; last_inr: number }[]> {
  const supabase = createServerClient();
  const { data: activePatients } = await supabase.from("patients").select("id, name").eq("status", "active");
  const ids = (activePatients ?? []).map((p) => p.id);
  if (ids.length === 0) return [];
  const { data: inrRows } = await supabase
    .from("patient_latest_inr")
    .select("patient_id, last_inr")
    .in("patient_id", ids)
    .gt("last_inr", 4.0);
  const byId = new Map((activePatients ?? []).map((p) => [p.id, p.name]));
  return (inrRows ?? []).map((r: any) => ({
    patient_id: r.patient_id,
    name: byId.get(r.patient_id) ?? "Unknown",
    last_inr: Number(r.last_inr),
  }));
}

export async function getPharmacists(): Promise<Pharmacist[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
  if (error) return [];
  return data as Pharmacist[];
}

export async function getCurrentPharmacist(): Promise<Pharmacist | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("id, full_name").eq("id", user.id).single();
  return data as Pharmacist | null;
}

export async function getClinicalEvents(patientId: string): Promise<ClinicalEvent[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("clinical_events")
    .select("*")
    .eq("patient_id", patientId)
    .order("event_date", { ascending: false });
  if (error) return [];
  return data as ClinicalEvent[];
}

export async function getMedications(patientId: string): Promise<Medication[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("medications")
    .select("*")
    .eq("patient_id", patientId)
    .order("active", { ascending: false })
    .order("start_date", { ascending: false });
  if (error) return [];
  return data as Medication[];
}

export async function getReminders(patientId: string): Promise<Reminder[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("patient_id", patientId)
    .order("completed", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) return [];
  return data as Reminder[];
}

export async function getTargetInrHistory(patientId: string): Promise<TargetInrHistoryEntry[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("target_inr_history")
    .select("*")
    .eq("patient_id", patientId)
    .order("effective_date", { ascending: true });
  if (error) return [];
  return data as TargetInrHistoryEntry[];
}

export async function getBiometricsHistory(patientId: string): Promise<BiometricsHistoryEntry[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("biometrics_history")
    .select("*")
    .eq("patient_id", patientId)
    .order("effective_date", { ascending: true });
  if (error) return [];
  return data as BiometricsHistoryEntry[];
}

export async function getAllPatients(): Promise<Patient[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("status", "active")
    .order("name");
  if (error) return [];
  return data as Patient[];
}

export async function getFollowUpStatuses(): Promise<FollowUpStatus[]> {
  const supabase = createServerClient();
  const { data: statuses, error } = await supabase.from("patient_followup_status").select("*");
  if (error) return [];
  const { data: patients } = await supabase.from("patients").select("id, name").eq("status", "active");
  const nameById = new Map((patients ?? []).map((p) => [p.id, p.name]));
  return (statuses ?? [])
    .filter((s) => nameById.has(s.patient_id))
    .map((s) => ({ ...s, patient_name: nameById.get(s.patient_id) })) as FollowUpStatus[];
}
