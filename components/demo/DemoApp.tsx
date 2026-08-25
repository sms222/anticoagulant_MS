"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { calculateAge } from "@/lib/types";
import { calculateRosendaalTTR, calculatePINRR, type InrReading, type TargetRangePeriod } from "@/lib/calculators/rosendaal";
import { calculateInrVariability, calculateExtremeValueRate } from "@/lib/calculators/inr-variability";
import { calculateHasBled, detectInteractingDrugs, hasBledInputsFromComorbidities } from "@/lib/calculators/has-bled";
import { calculateCha2ds2Vasc, cha2ds2VascFromComorbidities } from "@/lib/calculators/cha2ds2-vasc";

// ---------------------------------------------------------------------------
// Demo data model — a trimmed-down mirror of the real schema, held entirely
// in React state. Nothing here touches Supabase or any server action; a
// refresh throws it all away and reseeds from scratch, by design.
// ---------------------------------------------------------------------------
type Anticoagulant = "warfarin" | "apixaban";

interface DemoLab {
  id: string;
  date: string;
  value: number;
}

interface DemoMed {
  id: string;
  name: string;
  dose: string;
  active: boolean;
}

interface DemoScoreEntry {
  date: string;
  score: number;
}

interface DemoPatient {
  id: string;
  name: string;
  dob: string;
  sex: "male" | "female";
  weightKg: number;
  heightCm: number;
  anticoagulant: Anticoagulant;
  indication: string;
  targetInr: number;
  comorbidities: string[];
  alcoholExcess: boolean;
  smokingStatus: string | null;
  medications: DemoMed[];
  inrLabs: DemoLab[];
  creatinineLabs: DemoLab[];
  hasBledHistory: DemoScoreEntry[];
  chadsVascHistory: DemoScoreEntry[];
}

const COMORBIDITY_OPTIONS = [
  "Hypertension",
  "Diabetes mellitus",
  "Congestive heart failure / LV dysfunction",
  "Vascular disease (prior MI, PAD, aortic plaque)",
  "Prior stroke / TIA / thromboembolism",
  "Chronic kidney disease / renal impairment",
  "Hepatic impairment / liver disease",
  "Dyslipidemia",
  "Thyroid disorder",
  "Prior major bleeding",
  "Malignancy",
];

const SMOKING_OPTIONS = [
  { value: "never", label: "Never smoked" },
  { value: "former", label: "Former smoker" },
  { value: "current", label: "Current smoker" },
];

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function seedPatients(): DemoPatient[] {
  return [
    {
      id: "demo-1",
      name: "Amirah binti Yusof",
      dob: "1958-03-14",
      sex: "female",
      weightKg: 62,
      heightCm: 158,
      anticoagulant: "warfarin",
      indication: "Atrial fibrillation",
      targetInr: 2.5,
      comorbidities: ["Hypertension", "Dyslipidemia"],
      alcoholExcess: false,
      smokingStatus: "never",
      medications: [
        { id: uid(), name: "Warfarin", dose: "3mg OD", active: true },
        { id: uid(), name: "Amlodipine", dose: "5mg OD", active: true },
      ],
      inrLabs: [
        { id: uid(), date: daysAgo(84), value: 2.1 },
        { id: uid(), date: daysAgo(63), value: 2.6 },
        { id: uid(), date: daysAgo(42), value: 3.4 },
        { id: uid(), date: daysAgo(21), value: 2.4 },
        { id: uid(), date: daysAgo(3), value: 2.7 },
      ],
      creatinineLabs: [],
      hasBledHistory: [],
      chadsVascHistory: [],
    },
    {
      id: "demo-2",
      name: "Rajesh Kumar a/l Muniandy",
      dob: "1965-11-02",
      sex: "male",
      weightKg: 78,
      heightCm: 171,
      anticoagulant: "apixaban",
      indication: "Atrial fibrillation",
      targetInr: 0,
      comorbidities: ["Diabetes mellitus", "Chronic kidney disease / renal impairment"],
      alcoholExcess: false,
      smokingStatus: "former",
      medications: [{ id: uid(), name: "Apixaban", dose: "5mg BD", active: true }],
      inrLabs: [],
      creatinineLabs: [
        { id: uid(), date: daysAgo(90), value: 98 },
        { id: uid(), date: daysAgo(30), value: 105 },
      ],
      hasBledHistory: [],
      chadsVascHistory: [],
    },
  ];
}

export function DemoApp() {
  const [patients, setPatients] = useState<DemoPatient[]>(() => seedPatients());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = patients.find((p) => p.id === selectedId) ?? null;

  function updatePatient(id: string, fn: (p: DemoPatient) => DemoPatient) {
    setPatients((prev) => prev.map((p) => (p.id === id ? fn(p) : p)));
  }

  function resetDemo() {
    setPatients(seedPatients());
    setSelectedId(null);
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1.5rem 3rem" }}>
      <DemoBanner onReset={resetDemo} />
      {selected ? (
        <DemoPatientDetail patient={selected} onBack={() => setSelectedId(null)} onUpdate={(fn) => updatePatient(selected.id, fn)} />
      ) : (
        <DemoPatientList patients={patients} onSelect={setSelectedId} />
      )}
    </main>
  );
}

function DemoBanner({ onReset }: { onReset: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        border: "0.5px solid var(--border)",
        background: "var(--bg-accent)",
        borderRadius: 10,
        padding: "10px 14px",
        marginBottom: 20,
      }}
    >
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "var(--text-accent)" }}>Demo mode</p>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0" }}>
          Two fictional patients, entirely in your browser — nothing here reaches the clinic database. Refreshing
          the page resets everything back to the starting point.
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
        <button onClick={onReset} style={smallBtnStyle}>
          Reset demo
        </button>
        <Link href="/login" style={{ fontSize: 12, color: "var(--text-accent)", textDecoration: "none" }}>
          Exit to login &rarr;
        </Link>
      </div>
    </div>
  );
}

function DemoPatientList({ patients, onSelect }: { patients: DemoPatient[]; onSelect: (id: string) => void }) {
  return (
    <div>
      <h1 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 4px" }}>Demo patients</h1>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" }}>
        Click a patient to try editing comorbidities, medications, and labs — HAS-BLED and CHA2DS2-VASc recompute
        live, the same way they do in the real app.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        {patients.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            style={{
              textAlign: "left",
              border: "0.5px solid var(--border)",
              borderRadius: 12,
              padding: 16,
              background: "var(--surface-0)",
              cursor: "pointer",
            }}
          >
            <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{p.name}</p>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0", textTransform: "capitalize" }}>
              {p.anticoagulant} &middot; {p.indication}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "6px 0 0" }}>
              {calculateAge(p.dob)}y {p.sex} &middot; {p.weightKg}kg
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function DemoPatientDetail({
  patient,
  onBack,
  onUpdate,
}: {
  patient: DemoPatient;
  onBack: () => void;
  onUpdate: (fn: (p: DemoPatient) => DemoPatient) => void;
}) {
  const [tab, setTab] = useState<"metrics" | "labs" | "risk" | "meds">("metrics");
  const warfarin = patient.anticoagulant === "warfarin";
  const age = calculateAge(patient.dob);

  const inrReadings: InrReading[] = useMemo(
    () => patient.inrLabs.map((l) => ({ date: new Date(l.date), value: l.value })),
    [patient.inrLabs]
  );
  const ranges: TargetRangePeriod[] = useMemo(
    () => [{ from: new Date(0), low: patient.targetInr - 0.5, high: patient.targetInr + 0.5 }],
    [patient.targetInr]
  );
  const ttr = warfarin && inrReadings.length >= 2 ? calculateRosendaalTTR(inrReadings, ranges) : null;
  const pinrr = warfarin && inrReadings.length > 0 ? calculatePINRR(inrReadings, ranges) : null;
  const variability = warfarin && inrReadings.length >= 2 ? calculateInrVariability(inrReadings) : null;
  const extremeRate = warfarin && inrReadings.length > 0 ? calculateExtremeValueRate(inrReadings) : null;

  const activeDrugNames = patient.medications.filter((m) => m.active).map((m) => m.name);
  const interactingDrugs = detectInteractingDrugs(activeDrugNames);
  const labileInr = ttr !== null && inrReadings.length >= 2 && ttr.ttrPercent < 60;
  const hasBledInputs = hasBledInputsFromComorbidities(patient.comorbidities, patient.alcoholExcess);
  const hasBledResult = calculateHasBled(hasBledInputs, {
    elderly: age !== null && age > 65,
    labileInr,
    interactingDrugs,
  });

  const chadsFactors = cha2ds2VascFromComorbidities(patient.comorbidities, age, patient.sex);
  const chadsResult = calculateCha2ds2Vasc(chadsFactors);

  // Mirrors the real app's auto-recalc dedup logic: only write a new dated
  // history entry when the live-computed score actually differs from the
  // last one on file, so casual re-renders don't spam the timeline.
  const lastHasBled = useRef<number | null>(null);
  const lastChadsVasc = useRef<number | null>(null);
  useEffect(() => {
    if (lastHasBled.current !== hasBledResult.score) {
      lastHasBled.current = hasBledResult.score;
      onUpdate((p) => ({ ...p, hasBledHistory: [...p.hasBledHistory, { date: todayIso(), score: hasBledResult.score }].slice(-8) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBledResult.score]);
  useEffect(() => {
    if (lastChadsVasc.current !== chadsResult.score) {
      lastChadsVasc.current = chadsResult.score;
      onUpdate((p) => ({ ...p, chadsVascHistory: [...p.chadsVascHistory, { date: todayIso(), score: chadsResult.score }].slice(-8) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chadsResult.score]);

  const latestCreatinine = patient.creatinineLabs[patient.creatinineLabs.length - 1] ?? null;

  return (
    <div style={{ border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "0.5px solid var(--border)" }}>
        <div>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-accent)", fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 4 }}>
            &larr; Back to demo patients
          </button>
          <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>{patient.name}</p>
        </div>
      </div>

      <div style={{ display: "flex" }}>
        <div style={{ width: 240, flexShrink: 0, padding: 16, borderRight: "0.5px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <SidebarField label="Age" value={age?.toString() ?? "—"} />
            <SidebarField label="Weight" value={`${patient.weightKg}kg`} />
            <SidebarField label="Height" value={`${patient.heightCm}cm`} />
            <SidebarField
              label="Smoking"
              value={SMOKING_OPTIONS.find((o) => o.value === patient.smokingStatus)?.label ?? "—"}
            />
            <SidebarField label="Alcohol excess" value={patient.alcoholExcess ? "Yes" : "No"} />
          </div>
          <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 12 }}>
            <SidebarField label="Diagnosis" value={patient.indication} />
            {warfarin && <SidebarField label="Target range" value={`${(patient.targetInr - 0.5).toFixed(1)}–${(patient.targetInr + 0.5).toFixed(1)}`} />}
            <SidebarField label="Anticoagulant" value={patient.anticoagulant} />
          </div>
        </div>

        <div style={{ flex: 1, padding: 16, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 16, borderBottom: "0.5px solid var(--border)", marginBottom: 14, fontSize: 13 }}>
            {(
              [
                { key: "metrics", label: "Metrics" },
                { key: "labs", label: warfarin ? "INR labs" : "SCr labs" },
                { key: "risk", label: "Comorbidities" },
                { key: "meds", label: "Medications" },
              ] as const
            ).map((t) => (
              <span key={t.key} onClick={() => setTab(t.key)} style={demoTabStyle(tab === t.key)}>
                {t.label}
              </span>
            ))}
          </div>

          {tab === "metrics" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
                {warfarin ? (
                  <>
                    <MetricCard label="TTR (Rosendaal)" value={ttr ? `${ttr.ttrPercent.toFixed(0)}%` : "—"} />
                    <MetricCard label="PINRR" value={pinrr !== null ? `${pinrr.toFixed(0)}%` : "—"} />
                    <MetricCard label="CV-INR" value={variability ? `${variability.coefficientOfVariation.toFixed(1)}%` : "—"} />
                    <MetricCard label="Extreme values" value={extremeRate !== null ? `${extremeRate.toFixed(0)}%` : "—"} />
                  </>
                ) : (
                  <MetricCard label="Latest SCr" value={latestCreatinine ? `${latestCreatinine.value} µmol/L` : "—"} />
                )}
                <MetricCard label="HAS-BLED" value={`${hasBledResult.score} / 9`} />
                <MetricCard label="CHA2DS2-VASc" value={`${chadsResult.score} / 9`} />
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <ScorePanel
                  title="HAS-BLED (bleeding risk)"
                  score={hasBledResult.score}
                  history={patient.hasBledHistory}
                  note="Computed live from age, this patient's own TTR, active medications, and comorbidities/alcohol — same engine as the real app."
                />
                <ScorePanel
                  title="CHA2DS2-VASc (stroke risk)"
                  score={chadsResult.score}
                  history={patient.chadsVascHistory}
                  note="Computed live from age, sex, and comorbidities — try adding one below and watch it update."
                />
              </div>
            </div>
          )}

          {tab === "labs" && (
            <DemoLabsPanel
              warfarin={warfarin}
              labs={warfarin ? patient.inrLabs : patient.creatinineLabs}
              onAdd={(date, value) =>
                onUpdate((p) =>
                  warfarin
                    ? { ...p, inrLabs: [...p.inrLabs, { id: uid(), date, value }] }
                    : { ...p, creatinineLabs: [...p.creatinineLabs, { id: uid(), date, value }] }
                )
              }
              onDelete={(id) =>
                onUpdate((p) =>
                  warfarin
                    ? { ...p, inrLabs: p.inrLabs.filter((l) => l.id !== id) }
                    : { ...p, creatinineLabs: p.creatinineLabs.filter((l) => l.id !== id) }
                )
              }
            />
          )}

          {tab === "risk" && (
            <DemoRiskPanel
              comorbidities={patient.comorbidities}
              alcoholExcess={patient.alcoholExcess}
              smokingStatus={patient.smokingStatus}
              onChange={(comorbidities, alcoholExcess, smokingStatus) =>
                onUpdate((p) => ({ ...p, comorbidities, alcoholExcess, smokingStatus }))
              }
            />
          )}

          {tab === "meds" && (
            <DemoMedsPanel
              medications={patient.medications}
              onAdd={(name, dose) => onUpdate((p) => ({ ...p, medications: [...p.medications, { id: uid(), name, dose, active: true }] }))}
              onToggle={(id) =>
                onUpdate((p) => ({
                  ...p,
                  medications: p.medications.map((m) => (m.id === id ? { ...m, active: !m.active } : m)),
                }))
              }
              onDelete={(id) => onUpdate((p) => ({ ...p, medications: p.medications.filter((m) => m.id !== id) }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ScorePanel({ title, score, history, note }: { title: string; score: number; history: DemoScoreEntry[]; note: string }) {
  return (
    <div style={{ flex: 1, minWidth: 260, border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: 12 }}>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>{title}</p>
      <p style={{ fontSize: 15, margin: "2px 0 0" }}>{score} / 9</p>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 0" }}>{note}</p>
      {history.length > 0 && (
        <div style={{ marginTop: 10, borderTop: "0.5px solid var(--border)", paddingTop: 8 }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 4px" }}>Change history (this session)</p>
          {[...history].reverse().map((h, i) => (
            <p key={i} style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0" }}>
              {h.score} / 9 on {h.date}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function DemoLabsPanel({
  warfarin,
  labs,
  onAdd,
  onDelete,
}: {
  warfarin: boolean;
  labs: DemoLab[];
  onAdd: (date: string, value: number) => void;
  onDelete: (id: string) => void;
}) {
  const [date, setDate] = useState(todayIso());
  const [value, setValue] = useState("");
  const sorted = [...labs].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <label style={demoLabelStyle}>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={demoInputStyle} />
        </div>
        <div>
          <label style={demoLabelStyle}>{warfarin ? "INR value" : "SCr (µmol/L)"}</label>
          <input type="number" step="0.1" value={value} onChange={(e) => setValue(e.target.value)} style={demoInputStyle} />
        </div>
        <button
          onClick={() => {
            const v = Number(value);
            if (!v || Number.isNaN(v)) return;
            onAdd(date, v);
            setValue("");
          }}
          style={smallBtnStyle}
        >
          Add result
        </button>
      </div>
      {sorted.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No results yet.</p>
      ) : (
        sorted.map((l) => (
          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "0.5px solid var(--border)" }}>
            <span>{l.date}</span>
            <span>{l.value}{warfarin ? "" : " µmol/L"}</span>
            <button onClick={() => onDelete(l.id)} style={{ background: "none", border: "none", color: "var(--text-danger)", fontSize: 12, cursor: "pointer" }}>
              Remove
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function DemoRiskPanel({
  comorbidities,
  alcoholExcess,
  smokingStatus,
  onChange,
}: {
  comorbidities: string[];
  alcoholExcess: boolean;
  smokingStatus: string | null;
  onChange: (comorbidities: string[], alcoholExcess: boolean, smokingStatus: string | null) => void;
}) {
  function toggle(option: string) {
    const next = comorbidities.includes(option) ? comorbidities.filter((c) => c !== option) : [...comorbidities, option];
    onChange(next, alcoholExcess, smokingStatus);
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Toggle a box and watch HAS-BLED / CHA2DS2-VASc on the Metrics tab update instantly.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "6px 16px", marginBottom: 14 }}>
        {COMORBIDITY_OPTIONS.map((opt) => (
          <label key={opt} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={comorbidities.includes(opt)} onChange={() => toggle(opt)} />
            {opt}
          </label>
        ))}
      </div>
      <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <input type="checkbox" checked={alcoholExcess} onChange={(e) => onChange(comorbidities, e.target.checked, smokingStatus)} />
        Alcohol excess (&ge;8 units/week)
      </label>
      <div>
        <label style={demoLabelStyle}>Smoking status</label>
        <select
          value={smokingStatus ?? ""}
          onChange={(e) => onChange(comorbidities, alcoholExcess, e.target.value || null)}
          style={{ ...demoInputStyle, width: 200 }}
        >
          <option value="">—</option>
          {SMOKING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function DemoMedsPanel({
  medications,
  onAdd,
  onToggle,
  onDelete,
}: {
  medications: DemoMed[];
  onAdd: (name: string, dose: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Try adding "Aspirin" — it's an antiplatelet, so it feeds HAS-BLED's interacting-drugs component.
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <label style={demoLabelStyle}>Drug name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={demoInputStyle} />
        </div>
        <div>
          <label style={demoLabelStyle}>Dose</label>
          <input value={dose} onChange={(e) => setDose(e.target.value)} style={demoInputStyle} />
        </div>
        <button
          onClick={() => {
            if (!name.trim()) return;
            onAdd(name.trim(), dose.trim());
            setName("");
            setDose("");
          }}
          style={smallBtnStyle}
        >
          Add medication
        </button>
      </div>
      {medications.map((m) => (
        <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "6px 0", borderBottom: "0.5px solid var(--border)" }}>
          <span style={{ color: m.active ? "var(--text-primary)" : "var(--text-muted)" }}>
            {m.name} {m.dose && `· ${m.dose}`} {!m.active && "(inactive)"}
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onToggle(m.id)} style={{ background: "none", border: "none", color: "var(--text-accent)", fontSize: 12, cursor: "pointer" }}>
              {m.active ? "Discontinue" : "Reactivate"}
            </button>
            <button onClick={() => onDelete(m.id)} style={{ background: "none", border: "none", color: "var(--text-danger)", fontSize: 12, cursor: "pointer" }}>
              Remove
            </button>
          </span>
        </div>
      ))}
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "0.5px solid var(--border)", borderRadius: 10, padding: 12 }}>
      <p style={{ fontSize: 18, fontWeight: 600, margin: 0, color: "var(--text-accent)" }}>{value}</p>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>{label}</p>
    </div>
  );
}

function demoTabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "8px 0",
    cursor: "pointer",
    color: active ? "var(--text-accent)" : "var(--text-secondary)",
    fontWeight: active ? 500 : 400,
    borderBottom: active ? "2px solid var(--fill-accent)" : "2px solid transparent",
  };
}

const smallBtnStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "6px 12px",
  border: "0.5px solid var(--border-strong)",
  borderRadius: 6,
  background: "var(--surface-0)",
  cursor: "pointer",
};

const demoLabelStyle: React.CSSProperties = { fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 3 };
const demoInputStyle: React.CSSProperties = { fontSize: 13, padding: "6px 8px", border: "0.5px solid var(--border-strong)", borderRadius: 6, width: 130 };
