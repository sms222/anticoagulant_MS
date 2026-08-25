import Link from "next/link";
import { getAllPatients } from "@/lib/supabase/queries";
import { PatientSearch } from "@/components/home/PatientSearch";

export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  const patients = await getAllPatients();
  return (
    <main style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <Link href="/" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>
        &larr; Back to dashboard
      </Link>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 0 20px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>All active patients</h1>
        <Link href="/patients/new" style={{ fontSize: 13, color: "var(--text-accent)", textDecoration: "none" }}>
          + Add patient
        </Link>
      </div>
      <PatientSearch patients={patients} />
    </main>
  );
}
