import { getAllPatients } from "@/lib/supabase/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const patients = await getAllPatients();

  return (
    <main style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Anticoagulation Management System</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
        {patients.length} active patient{patients.length === 1 ? "" : "s"}
      </p>
      <div style={{ border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        {patients.map((p, i) => (
          <Link
            key={p.id}
            href={`/patients/${p.id}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: i < patients.length - 1 ? "0.5px solid var(--border)" : "none",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <span>{p.name}</span>
            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{p.anticoagulant_type}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
