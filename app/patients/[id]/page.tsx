import {
  getPatient,
  getEncounters,
  getLabResults,
  getScoringResults,
  getClinicalEvents,
  getMedications,
  getReminders,
  getPatientDocuments,
  getTargetInrHistory,
} from "@/lib/supabase/queries";
import { PatientChart } from "@/components/patient/PatientChart";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await getPatient(id);
  if (!patient) notFound();

  const [encounters, inrLabs, creatinineLabs, hasBledResults, clinicalEvents, medications, reminders, documents, targetInrHistory] =
    await Promise.all([
      getEncounters(patient.id),
      getLabResults(patient.id, "INR"),
      getLabResults(patient.id, "Serum creatinine"),
      getScoringResults(patient.id, "HAS-BLED"),
      getClinicalEvents(patient.id),
      getMedications(patient.id),
      getReminders(patient.id),
      getPatientDocuments(patient.id),
      getTargetInrHistory(patient.id),
    ]);

  return (
    <main style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <PatientChart
        patient={patient}
        encounters={encounters}
        inrLabs={inrLabs}
        creatinineLabs={creatinineLabs}
        hasBledResults={hasBledResults}
        clinicalEvents={clinicalEvents}
        medications={medications}
        reminders={reminders}
        documents={documents}
        targetInrHistory={targetInrHistory}
      />
    </main>
  );
}
