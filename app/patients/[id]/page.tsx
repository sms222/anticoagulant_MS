import {
  getPatient,
  getEncounters,
  getLabResults,
  getScoringResults,
  getClinicalEvents,
  getMedications,
  getReminders,
  getTargetInrHistory,
  getBiometricsHistory,
  getPharmacists,
  getActiveVisitForPatient,
} from "@/lib/supabase/queries";
import { PatientChart } from "@/components/patient/PatientChart";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await getPatient(id);
  if (!patient) notFound();

  const [
    encounters,
    inrLabs,
    creatinineLabs,
    allLabs,
    hasBledResults,
    chadsVascResults,
    clinicalEvents,
    medications,
    reminders,
    targetInrHistory,
    biometricsHistory,
    pharmacists,
    activeVisit,
  ] = await Promise.all([
    getEncounters(patient.id),
    getLabResults(patient.id, "INR"),
    getLabResults(patient.id, "Serum creatinine"),
    getLabResults(patient.id),
    getScoringResults(patient.id, "HAS-BLED"),
    getScoringResults(patient.id, "CHA2DS2-VASc"),
    getClinicalEvents(patient.id),
    getMedications(patient.id),
    getReminders(patient.id),
    getTargetInrHistory(patient.id),
    getBiometricsHistory(patient.id),
    getPharmacists(),
    getActiveVisitForPatient(patient.id),
  ]);

  return (
    <main style={{ padding: "2rem", maxWidth: 1440, margin: "0 auto" }}>
      <PatientChart
        patient={patient}
        encounters={encounters}
        inrLabs={inrLabs}
        creatinineLabs={creatinineLabs}
        allLabs={allLabs}
        hasBledResults={hasBledResults}
        chadsVascResults={chadsVascResults}
        clinicalEvents={clinicalEvents}
        medications={medications}
        reminders={reminders}
        targetInrHistory={targetInrHistory}
        biometricsHistory={biometricsHistory}
        pharmacists={pharmacists}
        activeVisit={activeVisit}
      />
    </main>
  );
}
