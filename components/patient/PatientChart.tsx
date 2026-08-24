"use client";

import { useState } from "react";
import type { Patient, Encounter, LabResult, ScoringResult } from "@/lib/types";
import { calculateAge, isWarfarin } from "@/lib/types";
import {
  calculateRosendaalTTR,
  calculatePINRR,
  type InrReading,
} from "@/lib/calculators/rosendaal";
import {
  calculateInrVariability,
  calculateExtremeValueRate,
} from "@/lib/calculators/inr-variability";

type Tab = "metrics" | "graph" | "history" | "labs" | "notes";

export function PatientChart({
  patient,
  encounters,
  inrLabs,
  creatinineLabs,
  hasBledResults,
}: {
  patient: Patient;
  encounters: Encounter[];
  inrLabs: LabResult[];
  creatinineLabs: LabResult[];
  hasBledResults: ScoringResult[];
}) {
  const [tab, setTab] = useState<Tab>("metrics");
  const warfarin = isWarfarin(patient);
  const age = calculateAge(patient.date_of_birth);

  const inrReadings: InrReading[] = inrLabs.map((l) => ({
    date: new Date(l.test_date),
    value: l.result_value,
  }));

  const ttr =
    warfarin && patient.target_inr_low && patient.target_inr_high
      ? calculateRosendaalTTR(inrReadings, patient.target_inr_low, patient.target_inr_high)
      : null;
  const pinrr =
    warfarin && patient.target_inr_low && patient.target_inr_high
      ? calculatePINRR(inrReadings, patient.target_inr_low, patient.target_inr_high)
      : null;
  const variability = warfarin ? calculateInrVariability(inrReadings) : null;
  const extremeRate = warfarin ? calculateExtremeValueRate(inrReadings) : null;
  const latestHasBled = hasBledResults.length
    ? hasBledResults[hasBledResults.length - 1].score_value
    : null;
  const latestCreatinine = creatinineLabs.length
    ? creatinineLabs[creatinineLabs.length - 1]
    : null;

  return (
    <div style={{ border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "0.5px solid var(--border)" }}>
        <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>{patient.name}</p>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0" }}>
          {patient.date_of_birth ? `DOB ${patient.date_of_birth}` : ""}
          {age !== null ? ` (${age}y)` : ""} &middot; {patient.anticoagulant_type}
        </p>
      </div>

      <div style={{ display: "flex" }}>
        <div style={{ width: 170, flexShrink: 0, padding: 14, borderRight: "0.5px solid var(--border)" }}>
          <SidebarField label="Sex" value={patient.sex ?? "—"} />
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <SidebarField label="Age" value={age?.toString() ?? "—"} />
            <SidebarField label="Weight" value={patient.weight_kg ? `${patient.weight_kg}kg` : "—"} />
            <SidebarField label="Height" value={patient.height_cm ? `${patient.height_cm}cm` : "—"} />
          </div>
          <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 12 }}>
            <SidebarField label="Indication" value={patient.indication.replace(/_/g, " ")} />
            {warfarin && (
              <SidebarField
                label="Target range"
                value={`${patient.target_inr_low}–${patient.target_inr_high}`}
              />
            )}
            <SidebarField label="Anticoagulant" value={patient.anticoagulant_type} />
            <SidebarField label="Intake date" value={patient.intake_date} />
          </div>
        </div>

        <div style={{ flex: 1, padding: "14px 18px", minWidth: 0 }}>
          <TabBar tab={tab} setTab={setTab} />

          {tab === "metrics" && (
            <MetricsView
              warfarin={warfarin}
              ttr={ttr}
              pinrr={pinrr}
              variability={variability}
              extremeRate={extremeRate}
              inrCount={inrLabs.length}
              latestHasBled={latestHasBled}
              latestCreatinine={latestCreatinine}
              weightKg={patient.weight_kg}
              age={age}
              sex={patient.sex}
            />
          )}
          {tab === "graph" && (
            <GraphView warfarin={warfarin} inrLabs={inrLabs} creatinineLabs={creatinineLabs} hasBledResults={hasBledResults} />
          )}
          {tab === "history" && <HistoryView encounters={encounters} />}
          {tab === "labs" && <LabsView inrLabs={inrLabs} creatinineLabs={creatinineLabs} />}
          {tab === "notes" && <NotesView encounters={encounters} />}
        </div>
      </div>
    </div>
  );
}

function SidebarField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 2px" }}>{label}</p>
      <p style={{ fontSize: 13, margin: "0 0 10px" }}>{value}</p>
    </div>
  );
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "metrics", label: "Metrics" },
    { key: "graph", label: "Graph" },
    { key: "history", label: "History" },
    { key: "labs", label: "Labs" },
    { key: "notes", label: "Notes" },
  ];
  return (
    <div style={{ display: "flex", gap: 16, borderBottom: "0.5px solid var(--border)", marginBottom: 12, fontSize: 13 }}>
      {tabs.map((t) => (
        <span
          key={t.key}
          onClick={() => setTab(t.key)}
          style={{
            paddingBottom: 8,
            cursor: "pointer",
            color: tab === t.key ? "var(--text-accent)" : "var(--text-muted)",
            fontWeight: tab === t.key ? 500 : 400,
            borderBottom: tab === t.key ? "2px solid var(--border-accent)" : "none",
          }}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius)", padding: "0.7rem" }}>
      <p style={{ fontSize: 10, color: "var(--text-secondary)", margin: "0 0 3px" }}>{label}</p>
      <p style={{ fontSize: 17, fontWeight: 500, margin: 0 }}>{value}</p>
    </div>
  );
}

function MetricsView(props: {
  warfarin: boolean;
  ttr: { ttrPercent: number } | null;
  pinrr: number | null;
  variability: { coefficientOfVariation: number; standardDeviation: number; mean: number } | null;
  extremeRate: number | null;
  inrCount: number;
  latestHasBled: number | null;
  latestCreatinine: LabResult | null;
  weightKg: number | null;
  age: number | null;
  sex: "male" | "female" | null;
}) {
  const { warfarin, ttr, pinrr, variability, extremeRate, inrCount, latestHasBled, latestCreatinine } = props;

  if (!warfarin) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
        <MetricCard label="Latest SCr" value={latestCreatinine ? `${latestCreatinine.result_value} ${latestCreatinine.unit}` : "—"} />
        <MetricCard label="HAS-BLED" value={latestHasBled?.toString() ?? "—"} />
        <MetricCard label="Renal checks logged" value={"see Graph tab"} />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
      <MetricCard label="TTR (Rosendaal)" value={ttr ? `${ttr.ttrPercent.toFixed(0)}%` : "—"} />
      <MetricCard label="PINRR" value={pinrr !== null ? `${pinrr.toFixed(0)}%` : "—"} />
      <MetricCard label="CV-INR" value={variability ? `${variability.coefficientOfVariation.toFixed(1)}%` : "—"} />
      <MetricCard label="SD-INR" value={variability ? variability.standardDeviation.toFixed(2) : "—"} />
      <MetricCard label="Mean INR" value={variability ? variability.mean.toFixed(1) : "—"} />
      <MetricCard label="Readings to date" value={inrCount.toString()} />
      <MetricCard label="Extreme values" value={extremeRate !== null ? `${extremeRate.toFixed(0)}%` : "—"} />
      <MetricCard label="HAS-BLED" value={latestHasBled?.toString() ?? "—"} />
    </div>
  );
}

function GraphView({
  warfarin,
  inrLabs,
  creatinineLabs,
  hasBledResults,
}: {
  warfarin: boolean;
  inrLabs: LabResult[];
  creatinineLabs: LabResult[];
  hasBledResults: ScoringResult[];
}) {
  const series = warfarin ? inrLabs : creatinineLabs;
  const label = warfarin ? "INR" : "Serum creatinine";
  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>{label} trend</p>
      <SimpleSparkline points={series.map((s) => s.result_value)} labels={series.map((s) => s.test_date)} />
      {hasBledResults.length > 0 && (
        <>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "12px 0 6px" }}>HAS-BLED over time</p>
          <SimpleSparkline points={hasBledResults.map((h) => h.score_value)} labels={hasBledResults.map((h) => h.score_date)} stepped />
        </>
      )}
    </div>
  );
}

function SimpleSparkline({ points, labels, stepped }: { points: number[]; labels: string[]; stepped?: boolean }) {
  if (points.length === 0) return <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No data yet</p>;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const w = 600;
  const h = 100;
  const stepX = w / Math.max(points.length - 1, 1);
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = h - ((p - min) / range) * (h - 20) - 10;
    return `${x},${y}`;
  });
  const path = stepped
    ? coords.reduce((acc, c, i) => {
        if (i === 0) return c;
        const [px] = coords[i - 1].split(",");
        const [, y] = c.split(",");
        return `${acc} ${px},${y} ${c}`;
      }, "")
    : coords.join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 110 }}>
      <polyline points={path} fill="none" stroke="#2a78d6" strokeWidth={2} />
      {coords.map((c, i) => {
        const [x, y] = c.split(",");
        return <circle key={i} cx={x} cy={y} r={3} fill="#2a78d6" />;
      })}
    </svg>
  );
}

function HistoryView({ encounters }: { encounters: Encounter[] }) {
  return (
    <div style={{ border: "0.5px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
        <thead>
          <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
            <th style={{ textAlign: "left", padding: "7px 8px", color: "var(--text-secondary)", fontWeight: 500, width: "22%" }}>Date</th>
            <th style={{ textAlign: "left", padding: "7px 8px", color: "var(--text-secondary)", fontWeight: 500, width: "22%" }}>Dose</th>
            <th style={{ textAlign: "left", padding: "7px 8px", color: "var(--text-secondary)", fontWeight: 500, width: "28%" }}>Next appt</th>
            <th style={{ textAlign: "left", padding: "7px 8px", color: "var(--text-secondary)", fontWeight: 500, width: "28%" }}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {encounters.map((e, i) => (
            <tr key={e.id} style={{ borderBottom: i < encounters.length - 1 ? "0.5px solid var(--border)" : "none" }}>
              <td style={{ padding: "7px 8px" }}>{e.encounter_date}</td>
              <td style={{ padding: "7px 8px" }}>{e.current_dose_mg ? `${e.current_dose_mg}mg` : "—"}</td>
              <td style={{ padding: "7px 8px", color: "var(--text-secondary)" }}>{e.next_appt_date ?? "—"}</td>
              <td style={{ padding: "7px 8px", color: "var(--text-secondary)", fontSize: 11 }}>
                {e.notes ? e.notes.slice(0, 40) + (e.notes.length > 40 ? "…" : "") : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LabsView({ inrLabs, creatinineLabs }: { inrLabs: LabResult[]; creatinineLabs: LabResult[] }) {
  const all = [...inrLabs, ...creatinineLabs].sort((a, b) => b.test_date.localeCompare(a.test_date));
  return (
    <div>
      <div
        style={{
          border: "1.5px dashed var(--border-strong)",
          borderRadius: 12,
          padding: "1.25rem",
          textAlign: "center",
          marginBottom: "1rem",
          color: "var(--text-secondary)",
          fontSize: 13,
        }}
      >
        Paste a lab screenshot here to auto-fill results — not wired up yet, pending AI pipeline approval
      </div>
      <div style={{ border: "0.5px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-secondary)", fontWeight: 500, width: "22%" }}>Date</th>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-secondary)", fontWeight: 500, width: "30%" }}>Test</th>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-secondary)", fontWeight: 500, width: "20%" }}>Value</th>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-secondary)", fontWeight: 500, width: "28%" }}>Source</th>
            </tr>
          </thead>
          <tbody>
            {all.map((l) => (
              <tr key={l.id} style={{ borderBottom: "0.5px solid var(--border)" }}>
                <td style={{ padding: "8px 10px" }}>{l.test_date}</td>
                <td style={{ padding: "8px 10px" }}>{l.test_name}</td>
                <td style={{ padding: "8px 10px" }}>{l.result_value} {l.unit}</td>
                <td style={{ padding: "8px 10px", color: "var(--text-secondary)" }}>{l.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NotesView({ encounters }: { encounters: Encounter[] }) {
  return (
    <div>
      {encounters.map((e) => (
        <div key={e.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "0.5px solid var(--border)" }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px", fontWeight: 500 }}>{e.encounter_date}</p>
          <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0 }}>{e.notes || "No notes recorded for this visit."}</p>
        </div>
      ))}
    </div>
  );
}
