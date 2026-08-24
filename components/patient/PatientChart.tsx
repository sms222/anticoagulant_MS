"use client";

import { useState } from "react";
import Link from "next/link";
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

type TopTab = "dosing" | "labs";
type SubTab = "metrics" | "graph" | "history" | "notes";

const riskColors: Record<string, { bg: string; text: string }> = {
  high: { bg: "var(--bg-danger)", text: "var(--text-danger)" },
  medium: { bg: "var(--bg-warning)", text: "var(--text-warning)" },
  low: { bg: "var(--bg-success)", text: "var(--text-success)" },
};

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
  const [topTab, setTopTab] = useState<TopTab>("dosing");
  const [subTab, setSubTab] = useState<SubTab>("metrics");
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

  const avgIntervalDays = (() => {
    if (inrLabs.length < 2) return null;
    const sorted = [...inrLabs].sort((a, b) => a.test_date.localeCompare(b.test_date));
    let totalDays = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalDays +=
        (new Date(sorted[i].test_date).getTime() - new Date(sorted[i - 1].test_date).getTime()) /
        (1000 * 60 * 60 * 24);
    }
    return Math.round(totalDays / (sorted.length - 1));
  })();

  const risk = patient.risk_class ? riskColors[patient.risk_class] : null;

  function handlePrint() {
    window.print();
  }

  return (
    <div style={{ border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "0.5px solid var(--border)" }}>
        <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>{patient.name}</p>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0" }}>
          {patient.date_of_birth ? `DOB ${patient.date_of_birth}` : ""}
          {patient.mrn ? ` \u00b7 ID ${patient.mrn}` : ""}
          {patient.address ? ` \u00b7 ${patient.address}` : ""}
        </p>
      </div>

      <div style={{ display: "flex" }}>
        <div style={{ width: 180, flexShrink: 0, padding: 14, borderRight: "0.5px solid var(--border)" }}>
          {patient.risk_class && risk && (
            <>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 4px" }}>Risk class</p>
              <span
                style={{
                  background: risk.bg,
                  color: risk.text,
                  fontSize: 12,
                  padding: "2px 8px",
                  borderRadius: "var(--radius)",
                  display: "inline-block",
                  marginBottom: 12,
                  textTransform: "capitalize",
                }}
              >
                {patient.risk_class}
              </span>
            </>
          )}
          <SidebarField label="Phone" value={patient.phone ?? "\u2014"} />
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <SidebarField label="Age" value={age?.toString() ?? "\u2014"} />
            <SidebarField label="Weight" value={patient.weight_kg ? `${patient.weight_kg}kg` : "\u2014"} />
            <SidebarField label="Height" value={patient.height_cm ? `${patient.height_cm}cm` : "\u2014"} />
          </div>
          <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 12 }}>
            <SidebarField label="Diagnosis" value={patient.indication.replace(/_/g, " ")} />
            {warfarin && (
              <SidebarField
                label="Target range"
                value={`${patient.target_inr_low}\u2013${patient.target_inr_high}`}
              />
            )}
            <SidebarField label="Anticoagulant" value={patient.anticoagulant_type} />
            <SidebarField label="Start date" value={patient.intake_date} />
          </div>
        </div>

        <div style={{ flex: 1, padding: "14px 18px", minWidth: 0 }}>
          <TopTabBar topTab={topTab} setTopTab={setTopTab} />

          {topTab === "dosing" && (
            <>
              <SubTabBar subTab={subTab} setSubTab={setSubTab} />
              {subTab === "metrics" && (
                <MetricsView
                  warfarin={warfarin}
                  ttr={ttr}
                  pinrr={pinrr}
                  variability={variability}
                  extremeRate={extremeRate}
                  inrCount={inrLabs.length}
                  avgIntervalDays={avgIntervalDays}
                  latestHasBled={latestHasBled}
                  latestCreatinine={latestCreatinine}
                />
              )}
              {subTab === "graph" && (
                <GraphView warfarin={warfarin} inrLabs={inrLabs} creatinineLabs={creatinineLabs} hasBledResults={hasBledResults} />
              )}
              {subTab === "history" && (
                <HistoryView encounters={encounters} inrLabs={inrLabs} targetLow={patient.target_inr_low} targetHigh={patient.target_inr_high} />
              )}
              {subTab === "notes" && <NotesView encounters={encounters} />}
            </>
          )}
          {topTab === "labs" && <LabsView inrLabs={inrLabs} creatinineLabs={creatinineLabs} />}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "12px 18px", borderTop: "0.5px solid var(--border)", justifyContent: "flex-end" }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <button style={{ fontSize: 13, padding: "6px 14px" }}>Back to list</button>
        </Link>
        <button style={{ fontSize: 13, padding: "6px 14px" }} onClick={handlePrint}>
          Print
        </button>
        <button
          disabled
          title="Editing isn't wired up yet"
          style={{
            background: "var(--surface-1)",
            color: "var(--text-muted)",
            border: "none",
            fontSize: 13,
            padding: "6px 14px",
            borderRadius: "var(--radius)",
            cursor: "not-allowed",
          }}
        >
          Save
        </button>
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

function TopTabBar({ topTab, setTopTab }: { topTab: TopTab; setTopTab: (t: TopTab) => void }) {
  const placeholders = ["Contacts", "Drugs", "Events", "Reminders", "Documents"];
  return (
    <div style={{ display: "flex", gap: 16, borderBottom: "0.5px solid var(--border)", marginBottom: 14, fontSize: 13, flexWrap: "wrap" }}>
      <span onClick={() => setTopTab("dosing")} style={tabStyle(topTab === "dosing")}>Dosing</span>
      <span onClick={() => setTopTab("labs")} style={tabStyle(topTab === "labs")}>Labs</span>
      {placeholders.map((p) => (
        <span key={p} style={{ paddingBottom: 8, color: "var(--text-muted)" }}>{p}</span>
      ))}
    </div>
  );
}

function SubTabBar({ subTab, setSubTab }: { subTab: SubTab; setSubTab: (t: SubTab) => void }) {
  const tabs: { key: SubTab; label: string }[] = [
    { key: "metrics", label: "Metrics" },
    { key: "graph", label: "Graph" },
    { key: "history", label: "History" },
    { key: "notes", label: "Notes" },
  ];
  return (
    <div style={{ display: "flex", gap: 16, borderBottom: "0.5px solid var(--border)", marginBottom: 12, fontSize: 13 }}>
      {tabs.map((t) => (
        <span key={t.key} onClick={() => setSubTab(t.key)} style={tabStyle(subTab === t.key)}>
          {t.label}
        </span>
      ))}
    </div>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    paddingBottom: 8,
    cursor: "pointer",
    color: active ? "var(--text-accent)" : "var(--text-muted)",
    fontWeight: active ? 500 : 400,
    borderBottom: active ? "2px solid var(--border-accent)" : "none",
  };
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius)", padding: "0.85rem" }}>
      <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "0 0 4px" }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>{value}</p>
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
  avgIntervalDays: number | null;
  latestHasBled: number | null;
  latestCreatinine: LabResult | null;
}) {
  const { warfarin, ttr, pinrr, variability, extremeRate, inrCount, avgIntervalDays, latestHasBled, latestCreatinine } = props;

  if (!warfarin) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <MetricCard label="Latest SCr" value={latestCreatinine ? `${latestCreatinine.result_value} ${latestCreatinine.unit}` : "\u2014"} />
        <MetricCard label="HAS-BLED" value={latestHasBled?.toString() ?? "\u2014"} />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
      <MetricCard label="TTR (Rosendaal)" value={ttr ? `${ttr.ttrPercent.toFixed(0)}%` : "\u2014"} />
      <MetricCard label="PINRR" value={pinrr !== null ? `${pinrr.toFixed(0)}%` : "\u2014"} />
      <MetricCard label="CV-INR" value={variability ? `${variability.coefficientOfVariation.toFixed(1)}%` : "\u2014"} />
      <MetricCard label="SD-INR" value={variability ? variability.standardDeviation.toFixed(2) : "\u2014"} />
      <MetricCard label="Mean INR" value={variability ? variability.mean.toFixed(1) : "\u2014"} />
      <MetricCard label="Monitoring interval" value={avgIntervalDays ? `${avgIntervalDays}d avg` : "\u2014"} />
      <MetricCard label="Readings to date" value={inrCount.toString()} />
      <MetricCard label="Extreme values" value={extremeRate !== null ? `${extremeRate.toFixed(0)}%` : "\u2014"} />
      <MetricCard label="HAS-BLED" value={latestHasBled?.toString() ?? "\u2014"} />
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
      <SimpleSparkline points={series.map((s) => s.result_value)} />
      {hasBledResults.length > 0 && (
        <>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "16px 0 6px" }}>HAS-BLED over time</p>
          <SimpleSparkline points={hasBledResults.map((h) => h.score_value)} stepped />
        </>
      )}
    </div>
  );
}

function SimpleSparkline({ points, stepped }: { points: number[]; stepped?: boolean }) {
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

function HistoryView({
  encounters,
  inrLabs,
  targetLow,
  targetHigh,
}: {
  encounters: Encounter[];
  inrLabs: LabResult[];
  targetLow: number | null;
  targetHigh: number | null;
}) {
  function inRangeBarFor(date: string) {
    const lab = inrLabs.find((l) => l.test_date === date);
    if (!lab || !targetLow || !targetHigh) return null;
    const v = lab.result_value;
    let pct: number;
    let color: string;
    if (v >= targetLow && v <= targetHigh) {
      pct = 90;
      color = "#1baf7a";
    } else {
      const diff = v < targetLow ? targetLow - v : v - targetHigh;
      if (diff <= 0.3) {
        pct = 60;
        color = "#eda100";
      } else {
        pct = 30;
        color = "#e34948";
      }
    }
    return { pct, color, value: v };
  }

  return (
    <div style={{ border: "0.5px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
        <thead>
          <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
            <th style={thStyle("18%")}>Date</th>
            <th style={thStyle("12%")}>INR</th>
            <th style={thStyle("14%")}>Dose</th>
            <th style={thStyle("16%")}>Room</th>
            <th style={thStyle("18%")}>In range</th>
            <th style={thStyle("22%")}>Comments</th>
          </tr>
        </thead>
        <tbody>
          {encounters.map((e, i) => {
            const bar = inRangeBarFor(e.encounter_date);
            return (
              <tr key={e.id} style={{ borderBottom: i < encounters.length - 1 ? "0.5px solid var(--border)" : "none" }}>
                <td style={tdStyle}>{e.encounter_date}</td>
                <td style={tdStyle}>{bar ? bar.value : "\u2014"}</td>
                <td style={tdStyle}>{e.current_dose_mg ? `${e.current_dose_mg}mg` : "\u2014"}</td>
                <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{e.room ?? "\u2014"}</td>
                <td style={tdStyle}>
                  {bar ? (
                    <div style={{ background: "var(--surface-1)", borderRadius: 3, height: 8, width: "100%", overflow: "hidden" }}>
                      <div style={{ background: bar.color, height: "100%", width: `${bar.pct}%` }} />
                    </div>
                  ) : (
                    "\u2014"
                  )}
                </td>
                <td style={{ ...tdStyle, color: "var(--text-secondary)", fontSize: 11 }}>
                  {e.notes ? e.notes.slice(0, 40) + (e.notes.length > 40 ? "\u2026" : "") : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function thStyle(width: string): React.CSSProperties {
  return { textAlign: "left", padding: "7px 8px", color: "var(--text-secondary)", fontWeight: 500, width };
}
const tdStyle: React.CSSProperties = { padding: "7px 8px" };

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
        Paste a lab screenshot here to auto-fill results \u2014 not wired up yet, pending AI pipeline approval
      </div>
      <div style={{ border: "0.5px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
              <th style={thStyle("22%")}>Date</th>
              <th style={thStyle("30%")}>Test</th>
              <th style={thStyle("20%")}>Value</th>
              <th style={thStyle("28%")}>Source</th>
            </tr>
          </thead>
          <tbody>
            {all.map((l) => (
              <tr key={l.id} style={{ borderBottom: "0.5px solid var(--border)" }}>
                <td style={tdStyle}>{l.test_date}</td>
                <td style={tdStyle}>{l.test_name}</td>
                <td style={tdStyle}>{l.result_value} {l.unit}</td>
                <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{l.source}</td>
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
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px", fontWeight: 500 }}>
            {e.encounter_date}
            {e.room ? ` \u00b7 ${e.room}` : ""}
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0 }}>{e.notes || "No notes recorded for this visit."}</p>
        </div>
      ))}
    </div>
  );
}
