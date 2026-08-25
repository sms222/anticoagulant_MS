import {
  getTodaysAppointments,
  getAllPatients,
  getFollowUpStatuses,
  getHighInrAlerts,
  getPharmacists,
  getCurrentPharmacist,
} from "@/lib/supabase/queries";
import { Dashboard } from "@/components/home/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [appointments, patients, followUps, highInrAlerts, pharmacists, currentPharmacist] = await Promise.all([
    getTodaysAppointments(),
    getAllPatients(),
    getFollowUpStatuses(),
    getHighInrAlerts(),
    getPharmacists(),
    getCurrentPharmacist(),
  ]);

  return (
    <Dashboard
      appointments={appointments}
      patients={patients}
      followUps={followUps}
      highInrAlerts={highInrAlerts}
      pharmacists={pharmacists}
      currentPharmacist={currentPharmacist}
    />
  );
}
