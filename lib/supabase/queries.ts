import { createServerClient } from "./server";
import type { Patient, Encounter, LabResult, ScoringResult } from "@/lib/types";

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
    .select("*")
    .eq("patient_id", patientId)
    .order("encounter_date", { ascending: false });
  if (error) return [];
  return data as Encounter[];
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
    .select("id, patient_id, score_date, score_value, scoring_tool_definitions(tool_name)")
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
  }));
}

export async function getTodaysAppointments() {
  const supabase = createServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("appointments")
    .select("id, scheduled_time, room, status, patient_id, patients(name, anticoagulant_type)")
    .eq("scheduled_date", today)
    .order("scheduled_time", { ascending: true });
  if (error) return [];
  return (data ?? []) as any[];
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
