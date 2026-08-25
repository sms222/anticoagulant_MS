"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type {
  Patient,
  Encounter,
  LabResult,
  ScoringResult,
  ClinicalEvent,
  Medication,
  Reminder,
  PatientDocument,
  TargetInrHistoryEntry,
} from "@/lib/types";
import { calculateAge, isWarfarin, formatIndication, EMERGENCY_CONTACT_TEMPLATE } from "@/lib/types";
import {
  calculateRosendaalTTR,
  calculatePINRR,
  type InrReading,
  type TargetRangePeriod,
} from "@/lib/calculators/rosendaal";
import {
  calculateInrVariability,
  calculateExtremeValueRate,
} from "@/lib/calculators/inr-variability";
import {
  updateEmergencyContact,
  updateTargetInr,
  addMedication,
  discontinueMedication,
  deleteMedication,
  addClinicalEvent,
  deleteClinicalEvent,
  addReminder,
  toggleReminder,
  deleteReminder,
  addPatientDocument,
  deletePatientDocument,
} from "@/app/actions/clinical";

type TopTab = "dosing" | "labs" | "contacts" | "drugs" | "events" | "reminders" | "documents";
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
  clinicalEvents,
  medications,
  reminders,
  documents,
  targetInrHistory,
}: {
  patient: Patient;
  encounters: Encounter[];
  inrLabs: LabResult[];
  creatinineLabs: LabResult[];
  hasBledResults: ScoringResult[];
  clinicalEvents: ClinicalEvent[];
  medications: Medication[];
  reminders: Reminder[];
  documents: PatientDocument[];
  targetInrHistory: TargetInrHistoryEntry[];
}) {
  const [topTab, setTopTab] = useState<TopTab>("dosing");
  const [subTab, setSubTab] = useState<SubTab>("metrics");
  const warfarin = isWarfarin(patient);
  const age = calculateAge(patient.date_of_birth);

  const inrReadings: InrReading[] = inrLabs.map((l) => ({
    date: new Date(l.test_date),
    value: l.result_value,
  }));

  const targetRanges: TargetRangePeriod[] =
    targetInrHistory.length > 0
      ? targetInrHistory.map((t) => ({
          from: new Date(t.effective_date),
          low: t.target_inr_low,
          high: t.target_inr_high,
        }))
      : patient.target_inr_low && patient.target_inr_high
      ? [{ from: new Date(patient.intake_date), low: patient.target_inr_low, high: patient.target_inr_high }]
      : [];

  const ttr = warfarin && targetRanges.length > 0 ? calculateRosendaalTTR(inrReadings, targetRanges) : null;
  const pinrr = warfarin && targetRanges.length > 0 ? calculatePINRR(inrReadings, targetRanges) : null;
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
            <SidebarField label="Diagnosis" value={formatIndication(patient.indication, patient.indication_detail)} />
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
                  patientId={patient.id}
                  warfarin={warfarin}
                  ttr={ttr}
                  pinrr={pinrr}
                  variability={variability}
                  extremeRate={extremeRate}
                  inrCount={inrLabs.length}
                  avgIntervalDays={avgIntervalDays}
                  latestHasBled={latestHasBled}
                  latestCreatinine={latestCreatinine}
                  targetInrHistory={targetInrHistory}
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
          {topTab === "contacts" && <ContactsView patientId={patient.id} value={patient.emergency_contact_info} />}
          {topTab === "drugs" && <DrugsView patientId={patient.id} medications={medications} />}
          {topTab === "events" && <EventsView patientId={patient.id} events={clinicalEvents} />}
          {topTab === "reminders" && <RemindersView patientId={patient.id} reminders={reminders} />}
          {topTab === "documents" && <DocumentsView patientId={patient.id} documents={documents} />}
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
  const tabs: { key: TopTab; label: string }[] = [
    { key: "dosing", label: "Dosing" },
    { key: "labs", label: "Labs" },
    { key: "contacts", label: "Contacts" },
    { key: "drugs", label: "Drugs" },
    { key: "events", label: "Events" },
    { key: "reminders", label: "Reminders" },
    { key: "documents", label: "Documents" },
  ];
  return (
    <div style={{ display: "flex", gap: 16, borderBottom: "0.5px solid var(--border)", marginBottom: 14, fontSize: 13, flexWrap: "wrap" }}>
      {tabs.map((t) => (
        <span key={t.key} onClick={() => setTopTab(t.key)} style={tabStyle(topTab === t.key)}>
          {t.label}
        </span>
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
  patientId: string;
  warfarin: boolean;
  ttr: { ttrPercent: number } | null;
  pinrr: number | null;
  variability: { coefficientOfVariation: number; standardDeviation: number; mean: number } | null;
  extremeRate: number | null;
  inrCount: number;
  avgIntervalDays: number | null;
  latestHasBled: number | null;
  latestCreatinine: LabResult | null;
  targetInrHistory: TargetInrHistoryEntry[];
}) {
  const {
    patientId,
    warfarin,
    ttr,
    pinrr,
    variability,
    extremeRate,
    inrCount,
    avgIntervalDays,
    latestHasBled,
    latestCreatinine,
    targetInrHistory,
  } = props;

  if (!warfarin) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <MetricCard label="Latest SCr" value={latestCreatinine ? `${latestCreatinine.result_value} ${latestCreatinine.unit}` : "\u2014"} />
        <MetricCard label="HAS-BLED" value={latestHasBled?.toString() ?? "\u2014"} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 18 }}>
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
      <TargetInrPanel patientId={patientId} history={targetInrHistory} />
    </div>
  );
}

function TargetInrPanel({ patientId, history }: { patientId: string; history: TargetInrHistoryEntry[] }) {
  const [showForm, setShowForm] = useState(false);
  const boundUpdate = updateTargetInr.bind(null, patientId);
  const sorted = [...history].sort((a, b) => (a.effective_date < b.effective_date ? 1 : -1));
  const current = sorted[0];

  return (
    <div style={{ border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showForm ? 10 : 0 }}>
        <div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>Target INR</p>
          <p style={{ fontSize: 15, margin: "2px 0 0" }}>
            {current ? `${current.target_inr} (${current.target_inr_low}\u2013${current.target_inr_high})` : "\u2014"}
          </p>
        </div>
        <SmallButton onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Update at this visit"}</SmallButton>
      </div>

      {showForm && (
        <form
          action={async (fd) => {
            await boundUpdate(fd);
            setShowForm(false);
          }}
          style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 10 }}
        >
          <FieldWrap width={120}>
            <label style={labelStyle}>New target INR</label>
            <input name="target_inr" type="number" step="0.1" required style={inputStyle} />
          </FieldWrap>
          <FieldWrap width={150}>
            <label style={labelStyle}>Effective from</label>
            <input name="effective_date" type="date" style={inputStyle} />
          </FieldWrap>
          <div style={{ marginBottom: 10 }}>
            <SmallButton type="submit">Save</SmallButton>
          </div>
        </form>
      )}

      {sorted.length > 1 && (
        <div style={{ marginTop: 12, borderTop: "0.5px solid var(--border)", paddingTop: 10 }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 6px" }}>History</p>
          {sorted.map((t) => (
            <p key={t.id} style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0" }}>
              {t.target_inr} ({t.target_inr_low}\u2013{t.target_inr_high}) from {t.effective_date}
            </p>
          ))}
        </div>
      )}
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
      <polyline points={path} fill="none" stroke="var(--text-accent)" strokeWidth={2} />
      {coords.map((c, i) => {
        const [x, y] = c.split(",");
        return <circle key={i} cx={x} cy={y} r={3} fill="var(--text-accent)" />;
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

// ---------------------------------------------------------------------------
// Shared small UI bits for the newly wired tabs
// ---------------------------------------------------------------------------
const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 13,
  padding: "6px 8px",
  border: "0.5px solid var(--border-strong)",
  borderRadius: "var(--radius)",
  background: "var(--surface-0)",
  color: "var(--text-primary)",
};

const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)", display: "block", margin: "0 0 3px" };

function FieldWrap({ children, width }: { children: React.ReactNode; width?: number | string }) {
  return <div style={{ marginBottom: 10, width: width ?? "100%" }}>{children}</div>;
}

function SmallButton({
  children,
  variant = "default",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "danger" }) {
  return (
    <button
      {...rest}
      style={{
        fontSize: 12,
        padding: "4px 10px",
        border: "none",
        borderRadius: "var(--radius)",
        cursor: "pointer",
        background: variant === "danger" ? "var(--bg-danger)" : "var(--surface-1)",
        color: variant === "danger" ? "var(--text-danger)" : "var(--text-primary)",
      }}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "8px 0 16px" }}>{text}</p>;
}

// ---------------------------------------------------------------------------
// Contacts — free text, prewritten next-of-kin / phone / email template
// ---------------------------------------------------------------------------
function ContactsView({ patientId, value }: { patientId: string; value: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const boundAction = updateEmergencyContact.bind(null, patientId);

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await boundAction(formData);
          setSavedAt(Date.now());
        });
      }}
    >
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 8px" }}>
        Next of kin and other emergency contact details. Free text \u2014 edit the template below as needed.
      </p>
      <textarea
        name="emergency_contact_info"
        defaultValue={value ?? EMERGENCY_CONTACT_TEMPLATE}
        rows={10}
        style={{ ...inputStyle, fontFamily: "inherit", lineHeight: 1.6, resize: "vertical" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <SmallButton type="submit" disabled={isPending}>
          {isPending ? "Saving\u2026" : "Save contact info"}
        </SmallButton>
        {savedAt && !isPending && (
          <span style={{ fontSize: 12, color: "var(--text-success)" }}>Saved</span>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Drugs — structured concomitant medication list
// ---------------------------------------------------------------------------
function DrugsView({ patientId, medications }: { patientId: string; medications: Medication[] }) {
  const [showForm, setShowForm] = useState(false);
  const boundAdd = addMedication.bind(null, patientId);
  const active = medications.filter((m) => m.active);
  const past = medications.filter((m) => !m.active);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <SmallButton onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "+ Add medication"}</SmallButton>
      </div>

      {showForm && (
        <form
          action={async (fd) => {
            await boundAdd(fd);
            setShowForm(false);
          }}
          style={{ border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: 12, marginBottom: 16 }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <FieldWrap>
              <label style={labelStyle}>Drug name</label>
              <input name="drug_name" required style={inputStyle} />
            </FieldWrap>
            <FieldWrap width={110}>
              <label style={labelStyle}>Dose</label>
              <input name="dose" required placeholder="e.g. 5mg" style={inputStyle} />
            </FieldWrap>
            <FieldWrap width={110}>
              <label style={labelStyle}>Frequency</label>
              <input name="frequency" required placeholder="e.g. OD" style={inputStyle} />
            </FieldWrap>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <FieldWrap width={130}>
              <label style={labelStyle}>Route</label>
              <input name="route" placeholder="oral" style={inputStyle} />
            </FieldWrap>
            <FieldWrap>
              <label style={labelStyle}>Indication</label>
              <input name="indication" style={inputStyle} />
            </FieldWrap>
            <FieldWrap width={140}>
              <label style={labelStyle}>Start date</label>
              <input name="start_date" type="date" style={inputStyle} />
            </FieldWrap>
          </div>
          <FieldWrap>
            <label style={labelStyle}>Notes</label>
            <input name="notes" style={inputStyle} />
          </FieldWrap>
          <SmallButton type="submit">Save medication</SmallButton>
        </form>
      )}

      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>Active</p>
      {active.length === 0 ? (
        <EmptyState text="No concomitant medications recorded." />
      ) : (
        active.map((m) => <MedicationRow key={m.id} patientId={patientId} medication={m} />)
      )}

      {past.length > 0 && (
        <>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "16px 0 6px" }}>Discontinued</p>
          {past.map((m) => (
            <MedicationRow key={m.id} patientId={patientId} medication={m} />
          ))}
        </>
      )}
    </div>
  );
}

function MedicationRow({ patientId, medication }: { patientId: string; medication: Medication }) {
  const boundDiscontinue = discontinueMedication.bind(null, patientId, medication.id);
  const boundDelete = deleteMedication.bind(null, patientId, medication.id);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 10px",
        border: "0.5px solid var(--border)",
        borderRadius: "var(--radius)",
        marginBottom: 6,
        opacity: medication.active ? 1 : 0.6,
      }}
    >
      <div>
        <p style={{ fontSize: 13, margin: 0 }}>
          {medication.drug_name} <span style={{ color: "var(--text-secondary)" }}>{medication.dose} \u00b7 {medication.frequency}</span>
          {medication.route ? <span style={{ color: "var(--text-muted)" }}> \u00b7 {medication.route}</span> : null}
        </p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
          {medication.indication ? `${medication.indication} \u00b7 ` : ""}
          from {medication.start_date}
          {medication.stop_date ? ` to ${medication.stop_date}` : ""}
        </p>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {medication.active && (
          <form action={boundDiscontinue}>
            <SmallButton type="submit">Discontinue</SmallButton>
          </form>
        )}
        <form action={boundDelete}>
          <SmallButton type="submit" variant="danger">Delete</SmallButton>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Events — wired to the clinical_events table (bleeding / clotting / hosp.)
// ---------------------------------------------------------------------------
const eventTypeColors: Record<string, { bg: string; text: string }> = {
  bleeding: { bg: "var(--bg-danger)", text: "var(--text-danger)" },
  clotting: { bg: "var(--bg-warning)", text: "var(--text-warning)" },
  hospitalization: { bg: "var(--bg-warning)", text: "var(--text-warning)" },
  other: { bg: "var(--surface-1)", text: "var(--text-secondary)" },
};

function EventsView({ patientId, events }: { patientId: string; events: ClinicalEvent[] }) {
  const [showForm, setShowForm] = useState(false);
  const [eventType, setEventType] = useState("bleeding");
  const boundAdd = addClinicalEvent.bind(null, patientId);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <SmallButton onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "+ Add event"}</SmallButton>
      </div>

      {showForm && (
        <form
          action={async (fd) => {
            await boundAdd(fd);
            setShowForm(false);
          }}
          style={{ border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: 12, marginBottom: 16 }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <FieldWrap width={160}>
              <label style={labelStyle}>Event type</label>
              <select
                name="event_type"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                style={inputStyle}
              >
                <option value="bleeding">Bleeding</option>
                <option value="clotting">Clotting</option>
                <option value="hospitalization">Hospitalization</option>
                <option value="other">Other</option>
              </select>
            </FieldWrap>
            {eventType === "bleeding" && (
              <FieldWrap width={160}>
                <label style={labelStyle}>Severity (ISTH)</label>
                <select name="bleeding_severity" defaultValue="minor" style={inputStyle}>
                  <option value="major">Major</option>
                  <option value="crnm">CRNM</option>
                  <option value="minor">Minor</option>
                </select>
              </FieldWrap>
            )}
            <FieldWrap width={140}>
              <label style={labelStyle}>Date</label>
              <input name="event_date" type="date" style={inputStyle} />
            </FieldWrap>
            <FieldWrap width={110}>
              <label style={labelStyle}>INR at event</label>
              <input name="inr_at_event" type="number" step="0.1" style={inputStyle} />
            </FieldWrap>
          </div>
          <FieldWrap>
            <label style={labelStyle}>Description</label>
            <input name="description" required style={inputStyle} />
          </FieldWrap>
          <FieldWrap>
            <label style={labelStyle}>Outcome</label>
            <input name="outcome" style={inputStyle} />
          </FieldWrap>
          <SmallButton type="submit">Save event</SmallButton>
        </form>
      )}

      {events.length === 0 ? (
        <EmptyState text="No bleeding, clotting, or hospitalization events recorded." />
      ) : (
        events.map((ev) => {
          const colors = eventTypeColors[ev.event_type];
          const boundDelete = deleteClinicalEvent.bind(null, patientId, ev.id);
          return (
            <div
              key={ev.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                padding: "8px 10px",
                border: "0.5px solid var(--border)",
                borderRadius: "var(--radius)",
                marginBottom: 6,
              }}
            >
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <span
                    style={{
                      background: colors.bg,
                      color: colors.text,
                      fontSize: 11,
                      padding: "1px 7px",
                      borderRadius: "var(--radius)",
                      textTransform: "capitalize",
                    }}
                  >
                    {ev.event_type}
                    {ev.bleeding_severity ? ` \u00b7 ${ev.bleeding_severity.toUpperCase()}` : ""}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ev.event_date}</span>
                  {ev.inr_at_event != null && (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>INR {ev.inr_at_event}</span>
                  )}
                </div>
                <p style={{ fontSize: 13, margin: 0 }}>{ev.description}</p>
                {ev.outcome && <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0" }}>Outcome: {ev.outcome}</p>}
              </div>
              <form action={boundDelete}>
                <SmallButton type="submit" variant="danger">Delete</SmallButton>
              </form>
            </div>
          );
        })
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reminders — freeform per-patient task list
// ---------------------------------------------------------------------------
function RemindersView({ patientId, reminders }: { patientId: string; reminders: Reminder[] }) {
  const boundAdd = addReminder.bind(null, patientId);
  const open = reminders.filter((r) => !r.completed);
  const done = reminders.filter((r) => r.completed);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <form
        action={boundAdd}
        style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "flex-end" }}
      >
        <FieldWrap>
          <label style={labelStyle}>Task</label>
          <input name="task" required placeholder="e.g. Call about missed dose" style={inputStyle} />
        </FieldWrap>
        <FieldWrap width={150}>
          <label style={labelStyle}>Due date</label>
          <input name="due_date" type="date" style={inputStyle} />
        </FieldWrap>
        <div style={{ marginBottom: 10 }}>
          <SmallButton type="submit">Add</SmallButton>
        </div>
      </form>

      {open.length === 0 ? (
        <EmptyState text="No open reminders." />
      ) : (
        open.map((r) => <ReminderRow key={r.id} patientId={patientId} reminder={r} overdue={!!r.due_date && r.due_date < today} />)
      )}

      {done.length > 0 && (
        <>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "16px 0 6px" }}>Completed</p>
          {done.map((r) => (
            <ReminderRow key={r.id} patientId={patientId} reminder={r} overdue={false} />
          ))}
        </>
      )}
    </div>
  );
}

function ReminderRow({ patientId, reminder, overdue }: { patientId: string; reminder: Reminder; overdue: boolean }) {
  const boundToggle = toggleReminder.bind(null, patientId, reminder.id, !reminder.completed);
  const boundDelete = deleteReminder.bind(null, patientId, reminder.id);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "7px 10px",
        border: "0.5px solid var(--border)",
        borderRadius: "var(--radius)",
        marginBottom: 6,
        opacity: reminder.completed ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <form action={boundToggle}>
          <button
            type="submit"
            title={reminder.completed ? "Mark as open" : "Mark as done"}
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              border: "1.5px solid var(--border-strong)",
              background: reminder.completed ? "var(--text-accent)" : "transparent",
              cursor: "pointer",
              padding: 0,
            }}
          />
        </form>
        <div>
          <p style={{ fontSize: 13, margin: 0, textDecoration: reminder.completed ? "line-through" : "none" }}>{reminder.task}</p>
          {reminder.due_date && (
            <p style={{ fontSize: 11, margin: "1px 0 0", color: overdue ? "var(--text-danger)" : "var(--text-muted)" }}>
              Due {reminder.due_date}{overdue ? " \u00b7 overdue" : ""}
            </p>
          )}
        </div>
      </div>
      <form action={boundDelete}>
        <SmallButton type="submit" variant="danger">Delete</SmallButton>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documents — link/metadata list. No file bytes stored; see handover notes
// on why real upload is deferred (Supabase Storage + governance sign-off).
// ---------------------------------------------------------------------------
function DocumentsView({ patientId, documents }: { patientId: string; documents: PatientDocument[] }) {
  const boundAdd = addPatientDocument.bind(null, patientId);

  return (
    <div>
      <div
        style={{
          border: "1.5px dashed var(--border-strong)",
          borderRadius: 12,
          padding: "0.9rem 1rem",
          marginBottom: 16,
          color: "var(--text-secondary)",
          fontSize: 12,
        }}
      >
        This stores links, not files \u2014 actual file upload needs a Supabase Storage bucket and the same
        governance sign-off as the AI pipeline. Paste a link to where the document already lives (e.g. hospital
        EMR, shared drive).
      </div>

      <form action={boundAdd} style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "flex-end" }}>
        <FieldWrap width={220}>
          <label style={labelStyle}>Label</label>
          <input name="label" required placeholder="e.g. Discharge summary" style={inputStyle} />
        </FieldWrap>
        <FieldWrap>
          <label style={labelStyle}>Link</label>
          <input name="url" type="url" required placeholder="https://\u2026" style={inputStyle} />
        </FieldWrap>
        <div style={{ marginBottom: 10 }}>
          <SmallButton type="submit">Add</SmallButton>
        </div>
      </form>

      {documents.length === 0 ? (
        <EmptyState text="No document links added." />
      ) : (
        documents.map((d) => {
          const boundDelete = deletePatientDocument.bind(null, patientId, d.id);
          return (
            <div
              key={d.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "7px 10px",
                border: "0.5px solid var(--border)",
                borderRadius: "var(--radius)",
                marginBottom: 6,
              }}
            >
              <div>
                <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--text-accent)" }}>
                  {d.label}
                </a>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>Added {d.added_at.slice(0, 10)}</p>
              </div>
              <form action={boundDelete}>
                <SmallButton type="submit" variant="danger">Delete</SmallButton>
              </form>
            </div>
          );
        })
      )}
    </div>
  );
}
