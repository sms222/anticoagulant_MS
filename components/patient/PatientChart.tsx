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
  TargetInrHistoryEntry,
  BiometricsHistoryEntry,
  Pharmacist,
  ActiveVisit,
} from "@/lib/types";
import { calculateAge, isWarfarin, formatIndication, EMERGENCY_CONTACT_TEMPLATE } from "@/lib/types";
import { formatDateDisplay } from "@/lib/format";
import { VisitGuard } from "./VisitGuard";
import {
  calculateRosendaalTTR,
  calculatePINRR,
  computeRollingTtr,
  computeRollingPinrr,
  type InrReading,
  type TargetRangePeriod,
} from "@/lib/calculators/rosendaal";
import {
  calculateInrVariability,
  calculateExtremeValueRate,
  computeRollingVariability,
} from "@/lib/calculators/inr-variability";
import {
  updateEmergencyContact,
  updateTargetInr,
  updateBiometrics,
  updatePatientNotes,
  updatePatientDetails,
  updatePatientRiskFactors,
  addLabResult,
  updateLabResult,
  deleteLabResult,
  addEncounter,
  updateEncounter,
  addHasBledAssessment,
  addCha2ds2VascAssessment,
  addMedication,
  updateMedication,
  discontinueMedication,
  deleteMedication,
  addClinicalEvent,
  updateClinicalEvent,
  deleteClinicalEvent,
  addReminder,
  updateReminder,
  toggleReminder,
  deleteReminder,
} from "@/app/actions/clinical";
import { INDICATION_OPTIONS, COMORBIDITY_OPTIONS, ETHNICITY_OPTIONS, SMOKING_STATUS_OPTIONS, NOAC_DOSING, LAB_TEST_CATALOG, LAB_CATEGORIES } from "@/lib/types";

type TopTab = "dosing" | "labs" | "contacts" | "notes" | "drugs" | "events" | "reminders";
type SubTab = "metrics" | "graph" | "history";

export function PatientChart({
  patient,
  encounters,
  inrLabs,
  creatinineLabs,
  allLabs,
  hasBledResults,
  chadsVascResults,
  clinicalEvents,
  medications,
  reminders,
  targetInrHistory,
  biometricsHistory,
  pharmacists,
  activeVisit,
}: {
  patient: Patient;
  encounters: Encounter[];
  inrLabs: LabResult[];
  creatinineLabs: LabResult[];
  allLabs: LabResult[];
  hasBledResults: ScoringResult[];
  chadsVascResults: ScoringResult[];
  clinicalEvents: ClinicalEvent[];
  medications: Medication[];
  reminders: Reminder[];
  targetInrHistory: TargetInrHistoryEntry[];
  biometricsHistory: BiometricsHistoryEntry[];
  pharmacists: Pharmacist[];
  activeVisit: ActiveVisit | null;
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

  function handlePrint() {
    window.print();
  }

  return (
    <div style={{ border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "0.5px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>{patient.name}</p>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0" }}>
            {patient.date_of_birth ? `DOB ${formatDateDisplay(patient.date_of_birth)}` : ""}
            {patient.mrn ? ` · ID ${patient.mrn}` : ""}
            {patient.address ? ` · ${patient.address}` : ""}
          </p>
        </div>
        <VisitGuard activeVisit={activeVisit} />
      </div>

      <div style={{ display: "flex" }}>
        <PatientDetailsSidebar patient={patient} age={age} warfarin={warfarin} />

        <div style={{ flex: 1, padding: "16px 28px", minWidth: 0 }}>
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
                  hasBledResults={hasBledResults}
                  chadsVascResults={chadsVascResults}
                  biometricsHistory={biometricsHistory}
                  ethnicity={patient.ethnicity}
                  smokingStatus={patient.smoking_status}
                  comorbidities={patient.comorbidities}
                  alcoholExcess={patient.alcohol_excess}
                />
              )}
              {subTab === "graph" && (
                <GraphView
                  warfarin={warfarin}
                  inrLabs={inrLabs}
                  creatinineLabs={creatinineLabs}
                  hasBledResults={hasBledResults}
                  rollingTtr={warfarin ? computeRollingTtr(inrReadings, targetRanges) : []}
                  rollingPinrr={warfarin ? computeRollingPinrr(inrReadings, targetRanges) : []}
                  rollingVariability={warfarin ? computeRollingVariability(inrReadings) : []}
                />
              )}
              {subTab === "history" && (
                <HistoryView
                  patientId={patient.id}
                  encounters={encounters}
                  inrLabs={inrLabs}
                  targetLow={patient.target_inr_low}
                  targetHigh={patient.target_inr_high}
                  pharmacists={pharmacists}
                />
              )}
            </>
          )}
          {topTab === "labs" && <LabsView patientId={patient.id} allLabs={allLabs} />}
          {topTab === "contacts" && <ContactsView patientId={patient.id} value={patient.emergency_contact_info} />}
          {topTab === "notes" && <PatientNotesView patientId={patient.id} value={patient.notes} />}
          {topTab === "drugs" && <DrugsView patientId={patient.id} medications={medications} />}
          {topTab === "events" && <EventsView patientId={patient.id} events={clinicalEvents} />}
          {topTab === "reminders" && <RemindersView patientId={patient.id} reminders={reminders} />}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "12px 18px", borderTop: "0.5px solid var(--border)", justifyContent: "flex-end" }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <button style={{ fontSize: 13, padding: "6px 14px" }}>Back to list</button>
        </Link>
        <button style={{ fontSize: 13, padding: "6px 14px" }} onClick={handlePrint}>
          Print
        </button>
      </div>
    </div>
  );
}

function PatientDetailsSidebar({
  patient,
  age,
  warfarin,
}: {
  patient: Patient;
  age: number | null;
  warfarin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [indication, setIndication] = useState(patient.indication);
  const boundUpdate = updatePatientDetails.bind(null, patient.id);

  if (editing) {
    return (
      <div style={{ width: 280, flexShrink: 0, padding: 14, borderRight: "0.5px solid var(--border)" }}>
        <form
          action={async (fd) => {
            await boundUpdate(fd);
            setEditing(false);
          }}
        >
          <FieldWrap>
            <label style={labelStyle}>MRN</label>
            <input name="mrn" defaultValue={patient.mrn ?? ""} style={inputStyle} />
          </FieldWrap>
          <FieldWrap>
            <label style={labelStyle}>Phone</label>
            <input name="phone" defaultValue={patient.phone ?? ""} style={inputStyle} />
          </FieldWrap>
          <FieldWrap>
            <label style={labelStyle}>Address</label>
            <input name="address" defaultValue={patient.address ?? ""} style={inputStyle} />
          </FieldWrap>
          <FieldWrap>
            <label style={labelStyle}>Indication</label>
            <select name="indication" value={indication} onChange={(e) => setIndication(e.target.value)} style={inputStyle}>
              {INDICATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FieldWrap>
          {indication === "other" && (
            <FieldWrap>
              <label style={labelStyle}>Indication (free text)</label>
              <input name="indication_detail" defaultValue={patient.indication_detail ?? ""} style={inputStyle} />
            </FieldWrap>
          )}
          <FieldWrap>
            <label style={labelStyle}>Anticoagulant</label>
            <select name="anticoagulant_type" defaultValue={patient.anticoagulant_type} style={inputStyle}>
              <option value="warfarin">Warfarin</option>
              <option value="rivaroxaban">Rivaroxaban</option>
              <option value="apixaban">Apixaban</option>
              <option value="dabigatran">Dabigatran</option>
              <option value="edoxaban">Edoxaban</option>
              <option value="other">Other</option>
            </select>
          </FieldWrap>
          <FieldWrap>
            <label style={labelStyle}>Start date</label>
            <input name="intake_date" type="date" defaultValue={patient.intake_date} style={inputStyle} />
          </FieldWrap>
          <div style={{ display: "flex", gap: 8 }}>
            <SmallButton type="submit">Save</SmallButton>
            <SmallButton type="button" onClick={() => setEditing(false)}>
              Cancel
            </SmallButton>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={{ width: 260, flexShrink: 0, padding: 16, borderRight: "0.5px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => setEditing(true)}
          title="Edit patient details"
          style={{ background: "none", border: "none", color: "var(--text-accent)", fontSize: 12, cursor: "pointer", padding: 0 }}
        >
          Edit
        </button>
      </div>
      <SidebarField label="MRN" value={patient.mrn ?? "—"} />
      <SidebarField label="Phone" value={patient.phone ?? "—"} />
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <SidebarField label="Age" value={age?.toString() ?? "—"} />
        <SidebarField label="Weight" value={patient.weight_kg ? `${patient.weight_kg}kg` : "—"} />
        <SidebarField label="Height" value={patient.height_cm ? `${patient.height_cm}cm` : "—"} />
        <SidebarField label="Smoking" value={SMOKING_STATUS_OPTIONS.find((o) => o.value === patient.smoking_status)?.label ?? "—"} />
        <SidebarField label="Alcohol excess" value={patient.alcohol_excess ? "Yes" : "No"} />
      </div>
      <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 12 }}>
        <SidebarField label="Diagnosis" value={formatIndication(patient.indication, patient.indication_detail)} />
        {warfarin && (
          <SidebarField label="Target range" value={`${patient.target_inr_low}–${patient.target_inr_high}`} />
        )}
        <SidebarField label="Anticoagulant" value={patient.anticoagulant_type} />
        <SidebarField label="Start date" value={formatDateDisplay(patient.intake_date)} />
      </div>
      {!warfarin && NOAC_DOSING[patient.anticoagulant_type] && (
        <NoacDosingBox dosing={NOAC_DOSING[patient.anticoagulant_type]} />
      )}
    </div>
  );
}

function NoacDosingBox({ dosing }: { dosing: (typeof NOAC_DOSING)[string] }) {
  return (
    <div style={{ borderTop: "0.5px solid var(--border)", marginTop: 12, paddingTop: 12 }}>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 0.3 }}>
        Dosing reference — {dosing.drug}
      </p>
      <p style={{ fontSize: 12, margin: "0 0 2px" }}>
        <strong>Standard:</strong> {dosing.standardDose}
      </p>
      <p style={{ fontSize: 12, margin: "0 0 2px" }}>
        <strong>Reduced:</strong> {dosing.reducedDose}
      </p>
      <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "2px 0" }}>{dosing.reductionCriteria}</p>
      <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "2px 0 6px" }}>{dosing.renalNotes}</p>
      <a
        href={dosing.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 10, color: "var(--text-accent)", textDecoration: "none" }}
      >
        Source: {dosing.source}
      </a>
      <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "4px 0 0" }}>
        Reference only — verify against the current Malaysian (NPRA-approved) package insert before applying to
        a specific patient.
      </p>
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
    { key: "notes", label: "Notes" },
    { key: "drugs", label: "Drugs" },
    { key: "events", label: "Events" },
    { key: "reminders", label: "Reminders" },
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
  hasBledResults: ScoringResult[];
  chadsVascResults: ScoringResult[];
  biometricsHistory: BiometricsHistoryEntry[];
  ethnicity: string | null;
  smokingStatus: string | null;
  comorbidities: string[];
  alcoholExcess: boolean;
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
    hasBledResults,
    chadsVascResults,
    biometricsHistory,
    ethnicity,
    smokingStatus,
    comorbidities,
    alcoholExcess,
  } = props;
  const hasComorbidities = comorbidities.length > 0;

  if (!warfarin) {
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 }}>
          <MetricCard label="Latest SCr" value={latestCreatinine ? `${latestCreatinine.result_value} ${latestCreatinine.unit}` : "—"} />
          <MetricCard label="HAS-BLED" value={latestHasBled?.toString() ?? "—"} />
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <RiskFactorsPanel
              patientId={patientId}
              ethnicity={ethnicity}
              smokingStatus={smokingStatus}
              comorbidities={comorbidities}
              alcoholExcess={alcoholExcess}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <HasBledPanel patientId={patientId} results={hasBledResults} hasComorbidities={hasComorbidities} />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <Cha2ds2VascPanel patientId={patientId} results={chadsVascResults} hasComorbidities={hasComorbidities} />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <BiometricsPanel patientId={patientId} history={biometricsHistory} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 }}>
        <MetricCard label="TTR (Rosendaal)" value={ttr ? `${ttr.ttrPercent.toFixed(0)}%` : "—"} />
        <MetricCard label="PINRR" value={pinrr !== null ? `${pinrr.toFixed(0)}%` : "—"} />
        <MetricCard label="CV-INR" value={variability ? `${variability.coefficientOfVariation.toFixed(1)}%` : "—"} />
        <MetricCard label="SD-INR" value={variability ? variability.standardDeviation.toFixed(2) : "—"} />
        <MetricCard label="Mean INR" value={variability ? variability.mean.toFixed(1) : "—"} />
        <MetricCard label="Monitoring interval" value={avgIntervalDays ? `${avgIntervalDays}d avg` : "—"} />
        <MetricCard label="Readings to date" value={inrCount.toString()} />
        <MetricCard label="Extreme values" value={extremeRate !== null ? `${extremeRate.toFixed(0)}%` : "—"} />
        <MetricCard label="HAS-BLED" value={latestHasBled?.toString() ?? "—"} />
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <TargetInrPanel patientId={patientId} history={targetInrHistory} />
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <RiskFactorsPanel
            patientId={patientId}
            ethnicity={ethnicity}
            smokingStatus={smokingStatus}
            comorbidities={comorbidities}
            alcoholExcess={alcoholExcess}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <HasBledPanel patientId={patientId} results={hasBledResults} hasComorbidities={hasComorbidities} />
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <Cha2ds2VascPanel patientId={patientId} results={chadsVascResults} hasComorbidities={hasComorbidities} />
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <BiometricsPanel patientId={patientId} history={biometricsHistory} />
        </div>
      </div>
    </div>
  );
}

function RiskFactorsPanel({
  patientId,
  ethnicity,
  smokingStatus,
  comorbidities,
  alcoholExcess,
}: {
  patientId: string;
  ethnicity: string | null;
  smokingStatus: string | null;
  comorbidities: string[];
  alcoholExcess: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const boundUpdate = updatePatientRiskFactors.bind(null, patientId);

  if (!editing) {
    return (
      <div style={{ border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: 12, height: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>Risk factors</p>
          <SmallButton onClick={() => setEditing(true)}>Edit</SmallButton>
        </div>
        <p style={{ fontSize: 12, margin: "8px 0 4px" }}>
          {ethnicity ?? "Ethnicity not recorded"}
          {smokingStatus ? ` · ${SMOKING_STATUS_OPTIONS.find((o) => o.value === smokingStatus)?.label ?? smokingStatus}` : ""}
          {alcoholExcess ? " · Alcohol excess" : ""}
        </p>
        {comorbidities.length > 0 ? (
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>{comorbidities.join(", ")}</p>
        ) : (
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>No comorbidities recorded</p>
        )}
      </div>
    );
  }

  return (
    <div style={{ border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: 12 }}>
      <form
        action={async (fd) => {
          await boundUpdate(fd);
          setEditing(false);
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <FieldWrap width={160}>
            <label style={labelStyle}>Ethnicity</label>
            <select name="ethnicity" defaultValue={ethnicity ?? ""} style={inputStyle}>
              <option value="">—</option>
              {ETHNICITY_OPTIONS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </FieldWrap>
          <FieldWrap width={170}>
            <label style={labelStyle}>Smoking status (optional)</label>
            <select name="smoking_status" defaultValue={smokingStatus ?? ""} style={inputStyle}>
              <option value="">Not asked</option>
              {SMOKING_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FieldWrap>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", margin: "6px 0 10px" }}>
          <input type="checkbox" name="alcohol_excess" defaultChecked={alcoholExcess} style={{ width: "auto", padding: 0 }} />
          Alcohol excess (≥8 units/week)
        </label>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 6px" }}>
          Comorbidities — feeds HAS-BLED and CHA2DS2-VASc directly, nothing else to enter for those scores
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 4, marginBottom: 10 }}>
          {COMORBIDITY_OPTIONS.map((c) => (
            <label key={c} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
              <input type="checkbox" name="comorbidities" value={c} defaultChecked={comorbidities.includes(c)} style={{ width: "auto", padding: 0 }} />
              {c}
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <SmallButton type="submit">Save</SmallButton>
          <SmallButton type="button" onClick={() => setEditing(false)}>
            Cancel
          </SmallButton>
        </div>
      </form>
    </div>
  );
}

function BiometricsPanel({ patientId, history }: { patientId: string; history: BiometricsHistoryEntry[] }) {
  const [showForm, setShowForm] = useState(false);
  const boundUpdate = updateBiometrics.bind(null, patientId);
  const sorted = [...history].sort((a, b) => (a.effective_date < b.effective_date ? 1 : -1));
  const current = sorted[0];

  return (
    <div style={{ border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: 12, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showForm ? 10 : 0 }}>
        <div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>Weight / height</p>
          <p style={{ fontSize: 15, margin: "2px 0 0" }}>
            {current ? `${current.weight_kg ?? "—"}kg · ${current.height_cm ?? "—"}cm` : "—"}
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
          style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 10, flexWrap: "wrap" }}
        >
          <FieldWrap width={100}>
            <label style={labelStyle}>Weight (kg)</label>
            <input name="weight_kg" type="number" step="0.1" style={inputStyle} />
          </FieldWrap>
          <FieldWrap width={100}>
            <label style={labelStyle}>Height (cm)</label>
            <input name="height_cm" type="number" step="0.1" style={inputStyle} />
          </FieldWrap>
          <FieldWrap width={140}>
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
          {sorted.map((b) => (
            <p key={b.id} style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0" }}>
              {b.weight_kg ?? "—"}kg · {b.height_cm ?? "—"}cm on {formatDateDisplay(b.effective_date)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function HasBledPanel({
  patientId,
  results,
  hasComorbidities,
}: {
  patientId: string;
  results: ScoringResult[];
  hasComorbidities: boolean;
}) {
  const boundAdd = addHasBledAssessment.bind(null, patientId);
  const sorted = [...results].sort((a, b) => (a.score_date < b.score_date ? 1 : -1));
  const latest = sorted[0];

  return (
    <div style={{ border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: 12, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>HAS-BLED (bleeding risk)</p>
          <p style={{ fontSize: 15, margin: "2px 0 0" }}>
            {latest ? `${latest.score_value} / 9 (${formatDateDisplay(latest.score_date)})` : "— no assessment yet"}
          </p>
        </div>
        <form action={boundAdd}>
          <SmallButton type="submit">Recalculate now</SmallButton>
        </form>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 0" }}>
        Computed from age, this patient's own TTR, active medications, and the comorbidities/alcohol
        recorded below — nothing entered here directly. Updates automatically whenever one of those
        changes; use the button only to force a fresh dated entry without changing anything.
        {!hasComorbidities && " No comorbidities recorded yet, so this will likely undercount."}
      </p>

      {sorted.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "0.5px solid var(--border)", paddingTop: 10 }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 6px" }}>History</p>
          {sorted.map((r) => (
            <p key={r.id} style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0" }}>
              {r.score_value} / 9 on {formatDateDisplay(r.score_date)}
              {r.components ? (
                <span style={{ color: "var(--text-muted)" }}>
                  {" "}
                  — {Object.entries(r.components)
                    .filter(([, v]) => v === true)
                    .map(([k]) => k)
                    .join(", ") || "no positive factors"}
                </span>
              ) : null}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Cha2ds2VascPanel({
  patientId,
  results,
  hasComorbidities,
}: {
  patientId: string;
  results: ScoringResult[];
  hasComorbidities: boolean;
}) {
  const boundAdd = addCha2ds2VascAssessment.bind(null, patientId);
  const sorted = [...results].sort((a, b) => (a.score_date < b.score_date ? 1 : -1));
  const latest = sorted[0];

  return (
    <div style={{ border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: 12, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>CHA2DS2-VASc (stroke risk)</p>
          <p style={{ fontSize: 15, margin: "2px 0 0" }}>
            {latest ? `${latest.score_value} / 9 (${formatDateDisplay(latest.score_date)})` : "— no assessment yet"}
          </p>
        </div>
        <form action={boundAdd}>
          <SmallButton type="submit">Recalculate now</SmallButton>
        </form>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 0" }}>
        Computed from age, sex, and the comorbidities recorded below — nothing entered here directly.
        Updates automatically whenever comorbidities change; use the button only to force a fresh dated
        entry without changing anything.
        {!hasComorbidities && " No comorbidities recorded yet, so this will likely undercount."}
      </p>

      {sorted.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "0.5px solid var(--border)", paddingTop: 10 }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 6px" }}>History</p>
          {sorted.map((r) => (
            <p key={r.id} style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0" }}>
              {r.score_value} / 9 on {formatDateDisplay(r.score_date)}
              {r.components ? (
                <span style={{ color: "var(--text-muted)" }}>
                  {" "}
                  — {Object.entries(r.components)
                    .filter(([, v]) => v === true)
                    .map(([k]) => k)
                    .join(", ") || "no positive factors"}
                </span>
              ) : null}
            </p>
          ))}
        </div>
      )}
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
            {current ? `${current.target_inr} (${current.target_inr_low}–${current.target_inr_high})` : "—"}
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
              {t.target_inr} ({t.target_inr_low}–{t.target_inr_high}) from {formatDateDisplay(t.effective_date)}
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
  rollingTtr,
  rollingPinrr,
  rollingVariability,
}: {
  warfarin: boolean;
  inrLabs: LabResult[];
  creatinineLabs: LabResult[];
  hasBledResults: ScoringResult[];
  rollingTtr: { date: Date; ttrPercent: number }[];
  rollingPinrr: { date: Date; pinrr: number }[];
  rollingVariability: { date: Date; cv: number; sd: number }[];
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

      {warfarin && (rollingTtr.length > 0 || rollingPinrr.length > 0 || rollingVariability.length > 0) && (
        <>
          <p style={{ fontSize: 13, fontWeight: 500, margin: "24px 0 4px" }}>Quality measures over time</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 12px" }}>
            Each point is computed cumulatively up to that visit — not a single end-of-course number.
          </p>

          {rollingTtr.length > 0 && (
            <>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>TTR (Rosendaal) over time</p>
              <SimpleSparkline points={rollingTtr.map((r) => r.ttrPercent)} />
            </>
          )}

          {rollingPinrr.length > 0 && (
            <>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "16px 0 6px" }}>PINRR over time</p>
              <SimpleSparkline points={rollingPinrr.map((r) => r.pinrr)} />
            </>
          )}

          {rollingVariability.length > 0 && (
            <>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "16px 0 6px" }}>CV-INR (%) over time</p>
              <SimpleSparkline points={rollingVariability.map((r) => r.cv)} />
            </>
          )}
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
  patientId,
  encounters,
  inrLabs,
  targetLow,
  targetHigh,
  pharmacists,
}: {
  patientId: string;
  encounters: Encounter[];
  inrLabs: LabResult[];
  targetLow: number | null;
  targetHigh: number | null;
  pharmacists: Pharmacist[];
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const boundAdd = addEncounter.bind(null, patientId);

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
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <SmallButton onClick={() => setShowAdd((v) => !v)}>{showAdd ? "Cancel" : "+ Add visit"}</SmallButton>
      </div>

      {showAdd && (
        <form
          action={async (fd) => {
            await boundAdd(fd);
            setShowAdd(false);
          }}
          style={{ border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: 12, marginBottom: 16 }}
        >
          <EncounterFields pharmacists={pharmacists} />
          <SmallButton type="submit">Save visit</SmallButton>
        </form>
      )}

      <div style={{ border: "0.5px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
              <th style={thStyle("13%")}>Date</th>
              <th style={thStyle("8%")}>INR</th>
              <th style={thStyle("10%")}>Dose</th>
              <th style={thStyle("12%")}>Room</th>
              <th style={thStyle("14%")}>Seen by</th>
              <th style={thStyle("13%")}>In range</th>
              <th style={thStyle("18%")}>Comments</th>
              <th style={thStyle("12%")}></th>
            </tr>
          </thead>
          <tbody>
            {encounters.map((e, i) => {
              const bar = inRangeBarFor(e.encounter_date);
              const isEditing = editingId === e.id;
              const boundUpdate = updateEncounter.bind(null, patientId, e.id);
              if (isEditing) {
                return (
                  <tr key={e.id} style={{ borderBottom: i < encounters.length - 1 ? "0.5px solid var(--border)" : "none" }}>
                    <td colSpan={8} style={{ padding: 10 }}>
                      <form
                        action={async (fd) => {
                          await boundUpdate(fd);
                          setEditingId(null);
                        }}
                      >
                        <EncounterFields encounter={e} pharmacists={pharmacists} />
                        <div style={{ display: "flex", gap: 8 }}>
                          <SmallButton type="submit">Save</SmallButton>
                          <SmallButton type="button" onClick={() => setEditingId(null)}>
                            Cancel
                          </SmallButton>
                        </div>
                      </form>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={e.id} style={{ borderBottom: i < encounters.length - 1 ? "0.5px solid var(--border)" : "none" }}>
                  <td style={tdStyle}>{formatDateDisplay(e.encounter_date)}</td>
                  <td style={tdStyle}>{bar ? bar.value : "—"}</td>
                  <td style={tdStyle}>{e.current_dose_mg ? `${e.current_dose_mg}mg` : "—"}</td>
                  <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{e.room ?? "—"}</td>
                  <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{e.seen_by_name ?? "—"}</td>
                  <td style={tdStyle}>
                    {bar ? (
                      <div style={{ background: "var(--surface-1)", borderRadius: 3, height: 8, width: "100%", overflow: "hidden" }}>
                        <div style={{ background: bar.color, height: "100%", width: `${bar.pct}%` }} />
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ ...tdStyle, color: "var(--text-secondary)", fontSize: 11 }}>
                    {e.notes ? e.notes.slice(0, 40) + (e.notes.length > 40 ? "…" : "") : ""}
                  </td>
                  <td style={tdStyle}>
                    <SmallButton onClick={() => setEditingId(e.id)}>Edit</SmallButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EncounterFields({ encounter, pharmacists }: { encounter?: Encounter; pharmacists: Pharmacist[] }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
      <FieldWrap width={140}>
        <label style={labelStyle}>Visit date</label>
        <input name="encounter_date" type="date" defaultValue={encounter?.encounter_date} required style={inputStyle} />
      </FieldWrap>
      <FieldWrap width={110}>
        <label style={labelStyle}>Dose (mg)</label>
        <input name="current_dose_mg" type="number" step="0.1" defaultValue={encounter?.current_dose_mg ?? ""} style={inputStyle} />
      </FieldWrap>
      <FieldWrap width={130}>
        <label style={labelStyle}>Room</label>
        <input name="room" defaultValue={encounter?.room ?? ""} style={inputStyle} />
      </FieldWrap>
      <FieldWrap width={150}>
        <label style={labelStyle}>Seen by</label>
        <select name="seen_by" defaultValue={encounter?.seen_by ?? ""} style={inputStyle}>
          <option value="">—</option>
          {pharmacists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
      </FieldWrap>
      <FieldWrap width={150}>
        <label style={labelStyle}>Next appointment</label>
        <input name="next_appt_date" type="date" defaultValue={encounter?.next_appt_date ?? ""} style={inputStyle} />
      </FieldWrap>
      <FieldWrap>
        <label style={labelStyle}>Notes</label>
        <input name="notes" defaultValue={encounter?.notes ?? ""} style={inputStyle} />
      </FieldWrap>
    </div>
  );
}

function thStyle(width: string): React.CSSProperties {
  return { textAlign: "left", padding: "7px 8px", color: "var(--text-secondary)", fontWeight: 500, width };
}
const tdStyle: React.CSSProperties = { padding: "7px 8px" };

function LabsView({
  patientId,
  allLabs,
}: {
  patientId: string;
  allLabs: LabResult[];
}) {
  const testNames = Array.from(new Set(allLabs.map((l) => l.test_name))).sort();
  const [categoryFilter, setCategoryFilter] = useState<string>("Coagulation");
  const [testFilter, setTestFilter] = useState(testNames.includes("INR") ? "INR" : "all");
  const [sortAsc, setSortAsc] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const boundAdd = addLabResult.bind(null, patientId);

  const testsInCategory = LAB_TEST_CATALOG.filter((t) => t.category === categoryFilter).map((t) => t.name);
  const filtered =
    testFilter === "all"
      ? categoryFilter === "all"
        ? allLabs
        : allLabs.filter((l) => testsInCategory.includes(l.test_name))
      : allLabs.filter((l) => l.test_name === testFilter);
  const all = [...filtered].sort((a, b) =>
    sortAsc ? a.test_date.localeCompare(b.test_date) : b.test_date.localeCompare(a.test_date)
  );

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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10 }}>
          <FieldWrap width={160}>
            <label style={labelStyle}>Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setTestFilter("all");
              }}
              style={inputStyle}
            >
              <option value="all">All categories</option>
              {LAB_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FieldWrap>
          <FieldWrap width={170}>
            <label style={labelStyle}>Test</label>
            <select value={testFilter} onChange={(e) => setTestFilter(e.target.value)} style={inputStyle}>
              <option value="all">All in category</option>
              {testNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </FieldWrap>
          <FieldWrap width={150}>
            <label style={labelStyle}>Order</label>
            <select value={sortAsc ? "asc" : "desc"} onChange={(e) => setSortAsc(e.target.value === "asc")} style={inputStyle}>
              <option value="asc">Oldest first</option>
              <option value="desc">Newest first</option>
            </select>
          </FieldWrap>
        </div>
        <SmallButton onClick={() => setShowAdd((v) => !v)}>{showAdd ? "Cancel" : "+ Add lab result"}</SmallButton>
      </div>

      {showAdd && (
        <form
          action={async (fd) => {
            await boundAdd(fd);
            setShowAdd(false);
          }}
          style={{ border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: 12, marginBottom: 16 }}
        >
          <LabResultFields />
          <SmallButton type="submit">Save result</SmallButton>
        </form>
      )}

      <div style={{ border: "0.5px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
              <th style={thStyle("18%")}>Date</th>
              <th style={thStyle("24%")}>Test</th>
              <th style={thStyle("16%")}>Value</th>
              <th style={thStyle("22%")}>Source</th>
              <th style={thStyle("20%")}></th>
            </tr>
          </thead>
          <tbody>
            {all.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  No {testFilter === "all" ? "" : testFilter} results recorded.
                </td>
              </tr>
            ) : (
              all.map((l) => {
                const isEditing = editingId === l.id;
                const boundUpdate = updateLabResult.bind(null, patientId, l.id);
                const boundDelete = deleteLabResult.bind(null, patientId, l.id);
                if (isEditing) {
                  return (
                    <tr key={l.id} style={{ borderBottom: "0.5px solid var(--border)" }}>
                      <td colSpan={5} style={{ padding: 10 }}>
                        <form
                          action={async (fd) => {
                            await boundUpdate(fd);
                            setEditingId(null);
                          }}
                        >
                          <LabResultFields lab={l} />
                          <div style={{ display: "flex", gap: 8 }}>
                            <SmallButton type="submit">Save</SmallButton>
                            <SmallButton type="button" onClick={() => setEditingId(null)}>
                              Cancel
                            </SmallButton>
                          </div>
                        </form>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={l.id} style={{ borderBottom: "0.5px solid var(--border)" }}>
                    <td style={tdStyle}>{formatDateDisplay(l.test_date)}</td>
                    <td style={tdStyle}>{l.test_name}</td>
                    <td style={tdStyle}>{l.result_value} {l.unit}</td>
                    <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{l.source}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <SmallButton onClick={() => setEditingId(l.id)}>Edit</SmallButton>
                        <form action={boundDelete}>
                          <SmallButton type="submit" variant="danger">
                            Delete
                          </SmallButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LabResultFields({ lab }: { lab?: LabResult }) {
  const [testName, setTestName] = useState(lab?.test_name ?? "INR");
  const [unit, setUnit] = useState(lab?.unit ?? LAB_TEST_CATALOG.find((t) => t.name === "INR")?.defaultUnit ?? "");

  function handleTestChange(name: string) {
    setTestName(name);
    const match = LAB_TEST_CATALOG.find((t) => t.name === name);
    if (match) setUnit(match.defaultUnit);
  }

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
      <FieldWrap width={190}>
        <label style={labelStyle}>Test</label>
        <select name="test_name" value={testName} onChange={(e) => handleTestChange(e.target.value)} style={inputStyle}>
          {LAB_CATEGORIES.map((cat) => (
            <optgroup key={cat} label={cat}>
              {LAB_TEST_CATALOG.filter((t) => t.category === cat).map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          ))}
          {!LAB_TEST_CATALOG.some((t) => t.name === testName) && <option value={testName}>{testName} (custom)</option>}
        </select>
      </FieldWrap>
      <FieldWrap width={110}>
        <label style={labelStyle}>Value</label>
        <input name="result_value" type="number" step="0.01" defaultValue={lab?.result_value ?? ""} required style={inputStyle} />
      </FieldWrap>
      <FieldWrap width={110}>
        <label style={labelStyle}>Unit</label>
        <input name="unit" value={unit} onChange={(e) => setUnit(e.target.value)} style={inputStyle} />
      </FieldWrap>
      <FieldWrap width={140}>
        <label style={labelStyle}>Date</label>
        <input name="test_date" type="date" defaultValue={lab?.test_date} required style={inputStyle} />
      </FieldWrap>
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
  const [editing, setEditing] = useState(!value); // no contact info yet → start in edit mode
  const boundAction = updateEmergencyContact.bind(null, patientId);

  if (!editing) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <SmallButton onClick={() => setEditing(true)}>Edit</SmallButton>
        </div>
        <pre
          style={{
            fontFamily: "inherit",
            fontSize: 14,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            margin: 0,
            border: "0.5px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: 12,
          }}
        >
          {value}
        </pre>
      </div>
    );
  }

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await boundAction(formData);
          setEditing(false);
        });
      }}
    >
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 8px" }}>
        Next of kin and other emergency contact details. Free text — edit the template below as needed.
      </p>
      <textarea
        name="emergency_contact_info"
        defaultValue={value ?? EMERGENCY_CONTACT_TEMPLATE}
        rows={10}
        style={{ ...inputStyle, fontFamily: "inherit", lineHeight: 1.6, resize: "vertical" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <SmallButton type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </SmallButton>
        {value && (
          <SmallButton type="button" onClick={() => setEditing(false)}>
            Cancel
          </SmallButton>
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
          <MedicationFields />
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
  const [editing, setEditing] = useState(false);
  const boundDiscontinue = discontinueMedication.bind(null, patientId, medication.id);
  const boundDelete = deleteMedication.bind(null, patientId, medication.id);
  const boundUpdate = updateMedication.bind(null, patientId, medication.id);

  if (editing) {
    return (
      <div style={{ border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: 12, marginBottom: 6 }}>
        <form
          action={async (fd) => {
            await boundUpdate(fd);
            setEditing(false);
          }}
        >
          <MedicationFields medication={medication} />
          <div style={{ display: "flex", gap: 8 }}>
            <SmallButton type="submit">Save</SmallButton>
            <SmallButton type="button" onClick={() => setEditing(false)}>
              Cancel
            </SmallButton>
          </div>
        </form>
      </div>
    );
  }

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
          {medication.drug_name} <span style={{ color: "var(--text-secondary)" }}>{medication.dose} · {medication.frequency}</span>
          {medication.route ? <span style={{ color: "var(--text-muted)" }}> · {medication.route}</span> : null}
        </p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
          {medication.indication ? `${medication.indication} · ` : ""}
          from {formatDateDisplay(medication.start_date)}
          {medication.stop_date ? ` to ${formatDateDisplay(medication.stop_date)}` : ""}
        </p>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <SmallButton onClick={() => setEditing(true)}>Edit</SmallButton>
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

function MedicationFields({ medication }: { medication?: Medication }) {
  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <FieldWrap>
          <label style={labelStyle}>Drug name</label>
          <input name="drug_name" defaultValue={medication?.drug_name} required style={inputStyle} />
        </FieldWrap>
        <FieldWrap width={110}>
          <label style={labelStyle}>Dose</label>
          <input name="dose" defaultValue={medication?.dose} required placeholder="e.g. 5mg" style={inputStyle} />
        </FieldWrap>
        <FieldWrap width={110}>
          <label style={labelStyle}>Frequency</label>
          <input name="frequency" defaultValue={medication?.frequency} required placeholder="e.g. OD" style={inputStyle} />
        </FieldWrap>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <FieldWrap width={130}>
          <label style={labelStyle}>Route</label>
          <input name="route" defaultValue={medication?.route ?? ""} placeholder="oral" style={inputStyle} />
        </FieldWrap>
        <FieldWrap>
          <label style={labelStyle}>Indication</label>
          <input name="indication" defaultValue={medication?.indication ?? ""} style={inputStyle} />
        </FieldWrap>
        <FieldWrap width={140}>
          <label style={labelStyle}>Start date</label>
          <input name="start_date" type="date" defaultValue={medication?.start_date} style={inputStyle} />
        </FieldWrap>
      </div>
      <FieldWrap>
        <label style={labelStyle}>Notes</label>
        <input name="notes" defaultValue={medication?.notes ?? ""} style={inputStyle} />
      </FieldWrap>
    </>
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
  const [editingId, setEditingId] = useState<string | null>(null);
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
          <EventFields />
          <SmallButton type="submit">Save event</SmallButton>
        </form>
      )}

      {events.length === 0 ? (
        <EmptyState text="No bleeding, clotting, or hospitalization events recorded." />
      ) : (
        events.map((ev) => {
          const colors = eventTypeColors[ev.event_type];
          const boundDelete = deleteClinicalEvent.bind(null, patientId, ev.id);
          const boundUpdate = updateClinicalEvent.bind(null, patientId, ev.id);
          const isEditing = editingId === ev.id;

          if (isEditing) {
            return (
              <div key={ev.id} style={{ border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: 12, marginBottom: 6 }}>
                <form
                  action={async (fd) => {
                    await boundUpdate(fd);
                    setEditingId(null);
                  }}
                >
                  <EventFields event={ev} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <SmallButton type="submit">Save</SmallButton>
                    <SmallButton type="button" onClick={() => setEditingId(null)}>
                      Cancel
                    </SmallButton>
                  </div>
                </form>
              </div>
            );
          }

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
                    {ev.bleeding_severity ? ` · ${ev.bleeding_severity.toUpperCase()}` : ""}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{formatDateDisplay(ev.event_date)}</span>
                  {ev.inr_at_event != null && (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>INR {ev.inr_at_event}</span>
                  )}
                </div>
                <p style={{ fontSize: 13, margin: 0 }}>{ev.description}</p>
                {ev.outcome && <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0" }}>Outcome: {ev.outcome}</p>}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <SmallButton onClick={() => setEditingId(ev.id)}>Edit</SmallButton>
                <form action={boundDelete}>
                  <SmallButton type="submit" variant="danger">Delete</SmallButton>
                </form>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function EventFields({ event }: { event?: ClinicalEvent }) {
  const [eventType, setEventType] = useState<string>(event?.event_type ?? "bleeding");
  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <FieldWrap width={160}>
          <label style={labelStyle}>Event type</label>
          <select name="event_type" value={eventType} onChange={(e) => setEventType(e.target.value)} style={inputStyle}>
            <option value="bleeding">Bleeding</option>
            <option value="clotting">Clotting</option>
            <option value="hospitalization">Hospitalization</option>
            <option value="other">Other</option>
          </select>
        </FieldWrap>
        {eventType === "bleeding" && (
          <FieldWrap width={160}>
            <label style={labelStyle}>Severity (ISTH)</label>
            <select name="bleeding_severity" defaultValue={event?.bleeding_severity ?? "minor"} style={inputStyle}>
              <option value="major">Major</option>
              <option value="crnm">CRNM</option>
              <option value="minor">Minor</option>
            </select>
          </FieldWrap>
        )}
        <FieldWrap width={140}>
          <label style={labelStyle}>Date</label>
          <input name="event_date" type="date" defaultValue={event?.event_date} style={inputStyle} />
        </FieldWrap>
        <FieldWrap width={110}>
          <label style={labelStyle}>INR at event</label>
          <input name="inr_at_event" type="number" step="0.1" defaultValue={event?.inr_at_event ?? ""} style={inputStyle} />
        </FieldWrap>
      </div>
      <FieldWrap>
        <label style={labelStyle}>Description</label>
        <input name="description" defaultValue={event?.description} required style={inputStyle} />
      </FieldWrap>
      <FieldWrap>
        <label style={labelStyle}>Outcome</label>
        <input name="outcome" defaultValue={event?.outcome ?? ""} style={inputStyle} />
      </FieldWrap>
    </>
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
  const [editing, setEditing] = useState(false);
  const boundToggle = toggleReminder.bind(null, patientId, reminder.id, !reminder.completed);
  const boundDelete = deleteReminder.bind(null, patientId, reminder.id);
  const boundUpdate = updateReminder.bind(null, patientId, reminder.id);

  if (editing) {
    return (
      <div style={{ border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: 10, marginBottom: 6 }}>
        <form
          action={async (fd) => {
            await boundUpdate(fd);
            setEditing(false);
          }}
          style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}
        >
          <FieldWrap>
            <label style={labelStyle}>Task</label>
            <input name="task" defaultValue={reminder.task} required style={inputStyle} />
          </FieldWrap>
          <FieldWrap width={150}>
            <label style={labelStyle}>Due date</label>
            <input name="due_date" type="date" defaultValue={reminder.due_date ?? ""} style={inputStyle} />
          </FieldWrap>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <SmallButton type="submit">Save</SmallButton>
            <SmallButton type="button" onClick={() => setEditing(false)}>
              Cancel
            </SmallButton>
          </div>
        </form>
      </div>
    );
  }

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
              Due {formatDateDisplay(reminder.due_date)}{overdue ? " · overdue" : ""}
            </p>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <SmallButton onClick={() => setEditing(true)}>Edit</SmallButton>
        <form action={boundDelete}>
          <SmallButton type="submit" variant="danger">Delete</SmallButton>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes — general free text at the patient level (links can just be pasted
// in as plain text; this replaced the separate Documents tab)
// ---------------------------------------------------------------------------
function PatientNotesView({ patientId, value }: { patientId: string; value: string | null }) {
  const [editing, setEditing] = useState(!value);
  const boundUpdate = updatePatientNotes.bind(null, patientId);

  if (!editing) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <SmallButton onClick={() => setEditing(true)}>Edit</SmallButton>
        </div>
        <pre
          style={{
            fontFamily: "inherit",
            fontSize: 14,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            margin: 0,
            border: "0.5px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: 12,
          }}
        >
          {value}
        </pre>
      </div>
    );
  }

  return (
    <form
      action={async (fd) => {
        await boundUpdate(fd);
        setEditing(false);
      }}
    >
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 8px" }}>
        General notes on this patient. Free text — paste links here too (e.g. to a document already
        on the hospital EMR or shared drive); there's no separate file storage.
      </p>
      <textarea
        name="notes"
        defaultValue={value ?? ""}
        rows={10}
        style={{ ...inputStyle, fontFamily: "inherit", lineHeight: 1.6, resize: "vertical" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <SmallButton type="submit">Save</SmallButton>
        {value && (
          <SmallButton type="button" onClick={() => setEditing(false)}>
            Cancel
          </SmallButton>
        )}
      </div>
    </form>
  );
}
