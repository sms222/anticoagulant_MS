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

export async function getAppointmentsForDate(date: string): Promise<TodaysAppointment[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, patient_id, scheduled_time, room, status, appointment_type, pharmacist_id, visit_started_at, visit_elapsed_seconds, patients(name, anticoagulant_type, target_inr_low, target_inr_high), profiles(full_name)"
    )
    .eq("scheduled_date", date)
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
    visit_started_at: row.visit_started_at ?? null,
    visit_elapsed_seconds: row.visit_elapsed_seconds ?? 0,
  }));
}

export async function getTodaysAppointments(): Promise<TodaysAppointment[]> {
  return getAppointmentsForDate(new Date().toISOString().slice(0, 10));
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

export interface PatientListRow {
  id: string;
  name: string;
  mrn: string | null;
  date_of_birth: string | null;
  intake_date: string;
  anticoagulant_type: string;
  target_inr_low: number | null;
  target_inr_high: number | null;
  last_encounter_date: string | null;
  next_appt_date: string | null;
}

export async function getPatientListRows(): Promise<PatientListRow[]> {
  const supabase = createServerClient();
  const [{ data: patients }, { data: followUps }] = await Promise.all([
    supabase
      .from("patients")
      .select("id, name, mrn, date_of_birth, intake_date, anticoagulant_type, target_inr_low, target_inr_high")
      .eq("status", "active"),
    supabase.from("patient_followup_status").select("patient_id, last_encounter_date, next_appt_date"),
  ]);
  const followUpById = new Map((followUps ?? []).map((f) => [f.patient_id, f]));
  return (patients ?? []).map((p) => ({
    ...p,
    last_encounter_date: followUpById.get(p.id)?.last_encounter_date ?? null,
    next_appt_date: followUpById.get(p.id)?.next_appt_date ?? null,
  }));
}

export interface DrugGroupMetrics {
  patientCount: number;
  avgTtr: number | null;
  ttrAbove65PctShare: number | null;
  avgPinrr: number | null;
  highInrShare: number | null;
  patientsAssessedForTtr: number;
  bleedingEvents90d: number;
  clottingEvents90d: number;
  avgHasBled: number | null;
  highHasBledShare: number | null;
  avgChadsVasc: number | null;
  highChadsVascShare: number | null;
}

export interface NoacDoseGroup {
  drug: string;
  doseMg: number;
  frequency: string;
  patientCount: number;
}

export interface VisitDurationStats {
  count: number;
  meanMinutes: number | null;
  medianMinutes: number | null;
  sdMinutes: number | null;
  histogram: { bucketLabel: string; count: number }[];
}

export interface ClinicReportData {
  activePatients: number;
  newEnrollments30d: number;
  appointmentsThisWeek: number;
  appointmentsThisMonth: number;
  noShowRate30d: number | null;
  appointmentTypeBreakdown30d: Record<string, number>;
  workloadByPharmacist: { name: string; count: number }[];
  warfarinPatientCount: number;
  noacPatientCount: number;
  combined: DrugGroupMetrics;
  warfarin: DrugGroupMetrics;
  noac: DrugGroupMetrics;
  noacDoseGroups: NoacDoseGroup[];
  visitDuration: VisitDurationStats;
}

function computeVisitDurationStats(durationsSeconds: number[]): VisitDurationStats {
  const count = durationsSeconds.length;
  if (count === 0) return { count: 0, meanMinutes: null, medianMinutes: null, sdMinutes: null, histogram: [] };
  const minutes = durationsSeconds.map((s) => s / 60);
  const mean = minutes.reduce((a, b) => a + b, 0) / count;
  const sorted = [...minutes].sort((a, b) => a - b);
  const mid = Math.floor(count / 2);
  const median = count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const variance = minutes.reduce((sum, v) => sum + (v - mean) ** 2, 0) / count;
  const sd = Math.sqrt(variance);

  const bucketWidth = 5;
  const bucketMax = 30;
  const labels: string[] = [];
  for (let start = 0; start < bucketMax; start += bucketWidth) labels.push(`${start}-${start + bucketWidth}`);
  labels.push(`${bucketMax}+`);
  const buckets = new Map<string, number>(labels.map((l) => [l, 0]));
  for (const m of minutes) {
    if (m >= bucketMax) {
      buckets.set(`${bucketMax}+`, (buckets.get(`${bucketMax}+`) ?? 0) + 1);
    } else {
      const start = Math.floor(m / bucketWidth) * bucketWidth;
      const label = `${start}-${start + bucketWidth}`;
      buckets.set(label, (buckets.get(label) ?? 0) + 1);
    }
  }
  return { count, meanMinutes: mean, medianMinutes: median, sdMinutes: sd, histogram: labels.map((l) => ({ bucketLabel: l, count: buckets.get(l) ?? 0 })) };
}

export async function getClinicReportData(): Promise<ClinicReportData> {
  const supabase = createServerClient();
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    { data: patients },
    { data: apptsThisWeek },
    { data: apptsThisMonth },
    { data: appts30d },
    { data: events90d },
    { data: hasBledRows },
    { data: chadsVascRows },
    { data: latestInrRows },
    { data: pharmacists },
    { data: noacEncounters },
    { data: completedAppts },
  ] = await Promise.all([
    supabase
      .from("patients")
      .select("id, intake_date, anticoagulant_type, target_inr_low, target_inr_high")
      .eq("status", "active"),
    supabase.from("appointments").select("id").gte("scheduled_date", startOfWeek.toISOString().slice(0, 10)).lte("scheduled_date", todayIso),
    supabase.from("appointments").select("id").gte("scheduled_date", startOfMonth.toISOString().slice(0, 10)).lte("scheduled_date", todayIso),
    supabase.from("appointments").select("status, appointment_type, pharmacist_id").gte("scheduled_date", thirtyDaysAgo),
    supabase.from("clinical_events").select("patient_id, event_type").gte("event_date", ninetyDaysAgo),
    supabase
      .from("scoring_tool_results")
      .select("patient_id, score_value, score_date, scoring_tool_definitions!inner(tool_name)")
      .eq("scoring_tool_definitions.tool_name", "HAS-BLED")
      .order("score_date", { ascending: false }),
    supabase
      .from("scoring_tool_results")
      .select("patient_id, score_value, score_date, scoring_tool_definitions!inner(tool_name)")
      .eq("scoring_tool_definitions.tool_name", "CHA2DS2-VASc")
      .order("score_date", { ascending: false }),
    supabase.from("patient_latest_inr").select("patient_id, last_inr"),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("encounters").select("patient_id, current_dose_mg, encounter_date").not("current_dose_mg", "is", null).order("encounter_date", { ascending: false }),
    supabase.from("appointments").select("visit_duration_seconds").eq("status", "completed").not("visit_duration_seconds", "is", null),
  ]);

  const activePatients = patients ?? [];
  const activePatientIds = new Set(activePatients.map((p) => p.id));
  const newEnrollments30d = activePatients.filter((p) => p.intake_date >= thirtyDaysAgo).length;

  const noShows = (appts30d ?? []).filter((a) => a.status === "no_show").length;
  const totalAppts30d = (appts30d ?? []).length;
  const noShowRate30d = totalAppts30d > 0 ? (noShows / totalAppts30d) * 100 : null;

  const appointmentTypeBreakdown30d: Record<string, number> = {};
  (appts30d ?? []).forEach((a) => {
    appointmentTypeBreakdown30d[a.appointment_type] = (appointmentTypeBreakdown30d[a.appointment_type] ?? 0) + 1;
  });

  const pharmacistNameById = new Map((pharmacists ?? []).map((p) => [p.id, p.full_name]));
  const countByPharmacist = new Map<string, number>();
  (appts30d ?? []).forEach((a) => {
    if (!a.pharmacist_id) return;
    countByPharmacist.set(a.pharmacist_id, (countByPharmacist.get(a.pharmacist_id) ?? 0) + 1);
  });
  const workloadByPharmacist = Array.from(countByPharmacist.entries())
    .map(([id, count]) => ({ name: pharmacistNameById.get(id) ?? "Unknown", count }))
    .sort((a, b) => b.count - a.count);

  // TTR/PINRR: computed per warfarin patient from their own INR history + target range history.
  // Computed once for all warfarin patients, then sliced per drug-group below.
  const warfarinPatients = activePatients.filter((p) => p.anticoagulant_type === "warfarin");
  const noacPatients = activePatients.filter((p) => p.anticoagulant_type !== "warfarin");
  const ttrPinrrByPatient = new Map<string, { ttr: number; pinrr: number }>();
  if (warfarinPatients.length > 0) {
    const { calculateRosendaalTTR, calculatePINRR } = await import("@/lib/calculators/rosendaal");
    const ids = warfarinPatients.map((p) => p.id);
    const [{ data: inrLabs }, { data: targetHistories }] = await Promise.all([
      supabase.from("lab_results").select("patient_id, result_value, test_date").eq("test_name", "INR").in("patient_id", ids),
      supabase.from("target_inr_history").select("patient_id, target_inr_low, target_inr_high, effective_date").in("patient_id", ids),
    ]);
    for (const p of warfarinPatients) {
      const readings = (inrLabs ?? [])
        .filter((l) => l.patient_id === p.id)
        .map((l) => ({ date: new Date(l.test_date), value: Number(l.result_value) }));
      const ranges = (targetHistories ?? [])
        .filter((t) => t.patient_id === p.id)
        .map((t) => ({ from: new Date(t.effective_date), low: Number(t.target_inr_low), high: Number(t.target_inr_high) }));
      const finalRanges =
        ranges.length > 0
          ? ranges
          : p.target_inr_low && p.target_inr_high
          ? [{ from: new Date(p.intake_date), low: p.target_inr_low, high: p.target_inr_high }]
          : [];
      if (readings.length >= 2 && finalRanges.length > 0) {
        ttrPinrrByPatient.set(p.id, {
          ttr: calculateRosendaalTTR(readings, finalRanges).ttrPercent,
          pinrr: calculatePINRR(readings, finalRanges),
        });
      }
    }
  }

  // Latest HAS-BLED / CHA2DS2-VASc per active patient.
  function latestPerPatient(rows: { patient_id: string; score_value: number }[] | null): Map<string, number> {
    const map = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!activePatientIds.has(r.patient_id) || map.has(r.patient_id)) continue;
      map.set(r.patient_id, r.score_value);
    }
    return map;
  }
  const hasBledByPatient = latestPerPatient(hasBledRows as any);
  const chadsVascByPatient = latestPerPatient(chadsVascRows as any);
  const latestInrByPatient = new Map((latestInrRows ?? []).filter((r) => activePatientIds.has(r.patient_id)).map((r) => [r.patient_id, Number(r.last_inr)]));
  const eventsByPatient = events90d ?? [];

  function computeGroup(groupPatients: { id: string }[]): DrugGroupMetrics {
    const ids = new Set(groupPatients.map((p) => p.id));
    const ttrValues: number[] = [];
    const pinrrValues: number[] = [];
    ids.forEach((id) => {
      const v = ttrPinrrByPatient.get(id);
      if (v) {
        ttrValues.push(v.ttr);
        pinrrValues.push(v.pinrr);
      }
    });
    const inrValues = Array.from(ids)
      .map((id) => latestInrByPatient.get(id))
      .filter((v): v is number => v !== undefined);
    const hasBledValues = Array.from(ids)
      .map((id) => hasBledByPatient.get(id))
      .filter((v): v is number => v !== undefined);
    const chadsVascValues = Array.from(ids)
      .map((id) => chadsVascByPatient.get(id))
      .filter((v): v is number => v !== undefined);
    const groupEvents = eventsByPatient.filter((e) => ids.has(e.patient_id));

    return {
      patientCount: ids.size,
      avgTtr: ttrValues.length > 0 ? ttrValues.reduce((a, b) => a + b, 0) / ttrValues.length : null,
      ttrAbove65PctShare: ttrValues.length > 0 ? (ttrValues.filter((t) => t >= 65).length / ttrValues.length) * 100 : null,
      avgPinrr: pinrrValues.length > 0 ? pinrrValues.reduce((a, b) => a + b, 0) / pinrrValues.length : null,
      highInrShare: inrValues.length > 0 ? (inrValues.filter((v) => v > 4.0).length / inrValues.length) * 100 : null,
      patientsAssessedForTtr: ttrValues.length,
      bleedingEvents90d: groupEvents.filter((e) => e.event_type === "bleeding").length,
      clottingEvents90d: groupEvents.filter((e) => e.event_type === "clotting").length,
      avgHasBled: hasBledValues.length > 0 ? hasBledValues.reduce((a, b) => a + b, 0) / hasBledValues.length : null,
      highHasBledShare: hasBledValues.length > 0 ? (hasBledValues.filter((v) => v >= 3).length / hasBledValues.length) * 100 : null,
      avgChadsVasc: chadsVascValues.length > 0 ? chadsVascValues.reduce((a, b) => a + b, 0) / chadsVascValues.length : null,
      highChadsVascShare: chadsVascValues.length > 0 ? (chadsVascValues.filter((v) => v >= 2).length / chadsVascValues.length) * 100 : null,
    };
  }

  // NOAC dose groups: latest recorded current_dose_mg per active NOAC patient
  // (from their most recent encounter with a dose on record), bucketed by
  // drug + mg amount. Frequency is looked up from NOAC_FREQUENCY, not stored
  // per-patient, since it's fixed by the approved regimen for each drug.
  const { NOAC_FREQUENCY } = await import("@/lib/types");
  const anticoagByPatient = new Map(activePatients.map((p) => [p.id, p.anticoagulant_type]));
  const latestDoseByPatient = new Map<string, number>();
  (noacEncounters ?? []).forEach((e: any) => {
    if (!anticoagByPatient.has(e.patient_id) || anticoagByPatient.get(e.patient_id) === "warfarin") return;
    if (!latestDoseByPatient.has(e.patient_id)) latestDoseByPatient.set(e.patient_id, Number(e.current_dose_mg));
  });
  const doseGroupCounts = new Map<string, number>();
  latestDoseByPatient.forEach((doseMg, patientId) => {
    const drug = anticoagByPatient.get(patientId)!;
    const key = `${drug}|${doseMg}`;
    doseGroupCounts.set(key, (doseGroupCounts.get(key) ?? 0) + 1);
  });
  const noacDoseGroups: NoacDoseGroup[] = Array.from(doseGroupCounts.entries())
    .map(([key, patientCount]) => {
      const [drug, doseMgStr] = key.split("|");
      return { drug, doseMg: Number(doseMgStr), frequency: NOAC_FREQUENCY[drug] ?? "", patientCount };
    })
    .sort((a, b) => (a.drug === b.drug ? b.doseMg - a.doseMg : a.drug.localeCompare(b.drug)));

  const visitDuration = computeVisitDurationStats((completedAppts ?? []).map((a: any) => Number(a.visit_duration_seconds)));

  return {
    activePatients: activePatientIds.size,
    newEnrollments30d,
    appointmentsThisWeek: (apptsThisWeek ?? []).length,
    appointmentsThisMonth: (apptsThisMonth ?? []).length,
    noShowRate30d,
    appointmentTypeBreakdown30d,
    workloadByPharmacist,
    warfarinPatientCount: warfarinPatients.length,
    noacPatientCount: noacPatients.length,
    combined: computeGroup(activePatients),
    warfarin: computeGroup(warfarinPatients),
    noac: computeGroup(noacPatients),
    noacDoseGroups,
    visitDuration,
  };
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
