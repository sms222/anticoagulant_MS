import {
  getAppointmentsForDate,
  getAllPatients,
  getFollowUpStatuses,
  getHighInrAlerts,
  getPharmacists,
  getCurrentPharmacist,
} from "@/lib/supabase/queries";
import { Dashboard } from "@/components/home/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const selectedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const todayIso = new Date().toISOString().slice(0, 10);
  const tomorrowIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [appointments, tomorrowAppointments, patients, followUps, highInrAlerts, pharmacists, currentPharmacist] = await Promise.all([
    getAppointmentsForDate(selectedDate),
    getAppointmentsForDate(tomorrowIso),
    getAllPatients(),
    getFollowUpStatuses(),
    getHighInrAlerts(),
    getPharmacists(),
    getCurrentPharmacist(),
  ]);

  return (
    <Dashboard
      appointments={appointments}
      tomorrowAppointments={tomorrowAppointments}
      patients={patients}
      followUps={followUps}
      highInrAlerts={highInrAlerts}
      pharmacists={pharmacists}
      currentPharmacist={currentPharmacist}
      selectedDate={selectedDate}
    />
  );
}
