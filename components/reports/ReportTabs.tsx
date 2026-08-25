"use client";

import { useState } from "react";
import type { DrugGroupMetrics, NoacDoseGroup } from "@/lib/supabase/queries";

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(0)}%`);

type TabKey = "combined" | "warfarin" | "noac";

export function ReportTabs({
  combined,
  warfarin,
  noac,
  noacDoseGroups,
}: {
  combined: DrugGroupMetrics;
  warfarin: DrugGroupMetrics;
  noac: DrugGroupMetrics;
  noacDoseGroups: NoacDoseGroup[];
}) {
  const [tab, setTab] = useState<TabKey>("combined");
  const data: Record<TabKey, DrugGroupMetrics> = { combined, warfarin, noac };
  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "combined", label: "Combined", count: combined.patientCount },
    { key: "warfarin", label: "Warfarin", count: warfarin.patientCount },
    { key: "noac", label: "NOAC", count: noac.patientCount },
  ];
  const d = data[tab];
  const isNoacOnly = tab === "noac";

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "0.5px solid var(--border)" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: tab === t.key ? 600 : 400,
              border: "none",
              borderBottom: tab === t.key ? "2px solid var(--fill-accent)" : "2px solid transparent",
              background: "none",
              color: tab === t.key ? "var(--text-accent)" : "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {d.patientCount === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 24px" }}>No active patients in this group.</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 8 }}>
            <Stat label="Avg TTR (Rosendaal)" value={isNoacOnly ? "—" : pct(d.avgTtr)} />
            <Stat label="Patients with TTR ≥65%" value={isNoacOnly ? "—" : pct(d.ttrAbove65PctShare)} />
            <Stat label="Avg PINRR" value={isNoacOnly ? "—" : pct(d.avgPinrr)} />
            <Stat label="Latest INR > 4.0" value={isNoacOnly ? "—" : pct(d.highInrShare)} />
          </div>
          {!isNoacOnly && (
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 24px" }}>
              Based on {d.patientsAssessedForTtr} patient{d.patientsAssessedForTtr === 1 ? "" : "s"} with enough INR
              readings to compute TTR (needs ≥2 readings and a target range on record).
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: isNoacOnly && noacDoseGroups.length > 0 ? 16 : 24 }}>
            <Stat label="Bleeding events (90d)" value={d.bleedingEvents90d.toString()} tone={d.bleedingEvents90d > 0 ? "danger" : undefined} />
            <Stat label="Clotting events (90d)" value={d.clottingEvents90d.toString()} tone={d.clottingEvents90d > 0 ? "warning" : undefined} />
            <Stat label="Avg HAS-BLED" value={d.avgHasBled?.toFixed(1) ?? "—"} />
            <Stat label="HAS-BLED ≥3 (high risk)" value={pct(d.highHasBledShare)} />
            <Stat label="Avg CHA2DS2-VASc" value={d.avgChadsVasc?.toFixed(1) ?? "—"} />
            <Stat label="CHA2DS2-VASc ≥2" value={pct(d.highChadsVascShare)} />
          </div>

          {isNoacOnly && <NoacDoseBox groups={noacDoseGroups} />}
        </>
      )}
    </div>
  );
}

function NoacDoseBox({ groups }: { groups: NoacDoseGroup[] }) {
  if (groups.length === 0) {
    return <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 24px" }}>No dose on record yet for active NOAC patients.</p>;
  }
  const byDrug = new Map<string, NoacDoseGroup[]>();
  groups.forEach((g) => {
    const list = byDrug.get(g.drug) ?? [];
    list.push(g);
    byDrug.set(g.drug, list);
  });

  return (
    <div style={{ border: "0.5px solid var(--border)", borderRadius: 8, padding: 14, marginBottom: 24 }}>
      <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 10px" }}>Patients by NOAC dose</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 24px" }}>
        {Array.from(byDrug.entries()).map(([drug, doseGroups]) => (
          <div key={drug} style={{ minWidth: 140 }}>
            <p style={{ fontSize: 12, fontWeight: 500, margin: "0 0 4px", textTransform: "capitalize" }}>{drug}</p>
            {doseGroups.map((g) => (
              <div key={`${g.drug}-${g.doseMg}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginBottom: 2 }}>
                <span>
                  {g.doseMg}mg {g.frequency}
                </span>
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{g.patientCount}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" | "warning" }) {
  const color = tone === "danger" ? "var(--text-danger)" : tone === "warning" ? "var(--text-warning)" : "var(--text-accent)";
  return (
    <div style={{ border: "0.5px solid var(--border)", borderRadius: 10, padding: 12 }}>
      <p style={{ fontSize: 20, fontWeight: 600, margin: 0, color }}>{value}</p>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>{label}</p>
    </div>
  );
}
