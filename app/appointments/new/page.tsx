import { getAllPatients, getPharmacists } from "@/lib/supabase/queries";
import { NewAppointmentForm } from "@/components/appointments/NewAppointmentForm";

export const dynamic = "force-dynamic";

export default async function NewAppointmentPage() {
  const [patients, pharmacists] = await Promise.all([getAllPatients(), getPharmacists()]);
  return (
    <main style={{ padding: "2rem", maxWidth: 640, margin: "0 auto" }}>
      <NewAppointmentForm patients={patients} pharmacists={pharmacists} />
    </main>
  );
}
