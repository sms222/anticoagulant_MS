"use client";

import { useState } from "react";
import Link from "next/link";
import type { Patient } from "@/lib/types";

export function PatientSearch({ patients }: { patients: Patient[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? patients.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.mrn ?? "").toLowerCase().includes(q)
      )
    : patients;

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or MRN…"
        style={{ width: "100%", marginBottom: 12 }}
      />
      <div style={{ border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <p style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            No patients match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          filtered.map((p, i) => (
            <Link
              key={p.id}
              href={`/patients/${p.id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: i < filtered.length - 1 ? "0.5px solid var(--border)" : "none",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <span>{p.name}</span>
              <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{p.anticoagulant_type}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
