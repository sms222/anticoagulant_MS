import { calculateRosendaalTTR, type InrReading } from "./rosendaal";

export interface PatientSummary {
  patientId: string;
  anticoagulantType: "warfarin" | "rivaroxaban" | "apixaban" | "dabigatran" | "edoxaban" | "other";
  inrReadings: InrReading[];
  targetLow: number;
  targetHigh: number;
  bleedingEventsCount: number;
  clottingEventsCount: number;
}

export interface ClinicWideMetrics {
  totalActivePatients: number;
  warfarinCount: number;
  noacCount: number;
  noacPercent: number;
  clinicAverageTtr: number;
  percentPatientsTtrAbove65: number;
  totalBleedingEvents: number;
  totalClottingEvents: number;
  bleedingEventRatePer100PatientYears: number | null; // requires observation-time data upstream
}

/**
 * Aggregates per-patient TTR and event data into clinic-wide KPIs.
 * Only warfarin patients contribute to the TTR average (no TTR-equivalent for NOACs).
 */
export function calculateClinicWideMetrics(patients: PatientSummary[]): ClinicWideMetrics {
  const totalActivePatients = patients.length;
  const warfarinPatients = patients.filter((p) => p.anticoagulantType === "warfarin");
  const noacCount = totalActivePatients - warfarinPatients.length;

  const ttrResults = warfarinPatients.map((p) =>
    calculateRosendaalTTR(p.inrReadings, p.targetLow, p.targetHigh)
  );

  const clinicAverageTtr =
    ttrResults.length > 0
      ? ttrResults.reduce((sum, r) => sum + r.ttrPercent, 0) / ttrResults.length
      : 0;

  const patientsAbove65 = ttrResults.filter((r) => r.ttrPercent > 65).length;
  const percentPatientsTtrAbove65 =
    ttrResults.length > 0 ? (patientsAbove65 / ttrResults.length) * 100 : 0;

  const totalBleedingEvents = patients.reduce((sum, p) => sum + p.bleedingEventsCount, 0);
  const totalClottingEvents = patients.reduce((sum, p) => sum + p.clottingEventsCount, 0);

  return {
    totalActivePatients,
    warfarinCount: warfarinPatients.length,
    noacCount,
    noacPercent: totalActivePatients > 0 ? (noacCount / totalActivePatients) * 100 : 0,
    clinicAverageTtr,
    percentPatientsTtrAbove65,
    totalBleedingEvents,
    totalClottingEvents,
    // Needs cumulative patient-years of observation, which isn't in this
    // function's inputs — wire this up once encounter date ranges are available.
    bleedingEventRatePer100PatientYears: null,
  };
}
