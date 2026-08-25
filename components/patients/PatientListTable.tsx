"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { PatientListRow } from "@/lib/supabase/queries";
import { calculateAge } from "@/lib/types";
import { formatDateDisplay } from "@/lib/format";

type SortKey = "name" | "mrn" | "age" | "intake_date" | "last_encounter_date" | "next_appt_date" | "target_inr" | "anticoagulant_type";

const columns: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "mrn", label: "MRN" },
  { key: "age", label: "Age" },
  { key: "intake_date", label: "Start date" },
  { key: "last_encounter_date", label: "Last appointment" },
  { key: "next_appt_date", label: "Next appointment" },
  { key: "target_inr", label: "Target INR" },
  { key: "anticoagulant_type", label: "Drug" },
];

export function PatientListTable({ rows }: { rows: PatientListRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [query, setQuery] = useState("");

  const enriched = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        age: calculateAge(r.date_of_birth),
        target_inr_mid: r.target_inr_low !== null && r.target_inr_high !== null ? (r.target_inr_low + r.target_inr_high) / 2 : null,
      })),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? enriched.filter((r) => r.name.toLowerCase().includes(q) || (r.mrn ?? "").toLowerCase().includes(q)) : enriched;
  }, [enriched, query]);

  const sorted = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return dir * a.name.localeCompare(b.name);
        case "mrn":
          return dir * (a.mrn ?? "").localeCompare(b.mrn ?? "");
        case "age":
          return dir * ((a.age ?? -1) - (b.age ?? -1));
        case "intake_date":
          return dir * a.intake_date.localeCompare(b.intake_date);
        case "last_encounter_date":
          return dir * (a.last_encounter_date ?? "").localeCompare(b.last_encounter_date ?? "");
        case "next_appt_date":
          return dir * (a.next_appt_date ?? "").localeCompare(b.next_appt_date ?? "");
        case "target_inr":
          return dir * ((a.target_inr_mid ?? -1) - (b.target_inr_mid ?? -1));
        case "anticoagulant_type":
          return dir * a.anticoagulant_type.localeCompare(b.anticoagulant_type);
        default:
          return 0;
      }
    });
  }, [filtered, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or MRN…"
        style={{ width: 280, marginBottom: 12 }}
      />
      <div style={{ border: "0.5px solid var(--border)", borderRadius: 8, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)", background: "var(--surface-1)" }}>
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => handleSort(c.key)}
                  style={{
                    padding: "9px 12px",
                    textAlign: "left",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.label}
                  {sortKey === c.key ? (sortAsc ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>
                  No patients match.
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr key={r.id} style={{ borderBottom: "0.5px solid var(--border)" }}>
                  <td style={td}>
                    <Link href={`/patients/${r.id}`} style={{ color: "var(--text-accent)", textDecoration: "none", fontWeight: 500 }}>
                      {r.name}
                    </Link>
                  </td>
                  <td style={{ ...td, color: "var(--text-secondary)" }}>{r.mrn ?? "—"}</td>
                  <td style={td}>{r.age ?? "—"}</td>
                  <td style={td}>{formatDateDisplay(r.intake_date)}</td>
                  <td style={td}>{r.last_encounter_date ? formatDateDisplay(r.last_encounter_date) : "—"}</td>
                  <td style={td}>{r.next_appt_date ? formatDateDisplay(r.next_appt_date) : "—"}</td>
                  <td style={td}>
                    {r.target_inr_low && r.target_inr_high ? `${r.target_inr_low}–${r.target_inr_high}` : "—"}
                  </td>
                  <td style={{ ...td, textTransform: "capitalize" }}>{r.anticoagulant_type}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const td: React.CSSProperties = { padding: "8px 12px", whiteSpace: "nowrap" };
