import Link from "next/link";
import { getClinicReportData } from "@/lib/supabase/queries";
import { APPOINTMENT_TYPE_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const d = await getClinicReportData();
  const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(0)}%`);

  return (
    <main style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      <Link href="/" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>
        &larr; Back to dashboard
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 500, margin: "8px 0 4px" }}>Clinic reports</h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 24px" }}>
        Workload and quality KPIs, computed live from clinic data. See the note at the bottom on how these were
        chosen and what to treat with caution.
      </p>

      <SectionHeading>Workload</SectionHeading>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <Stat label="Active patients" value={d.activePatients.toString()} />
        <Stat label="New enrollments (30d)" value={d.newEnrollments30d.toString()} />
        <Stat label="Appointments this week" value={d.appointmentsThisWeek.toString()} />
        <Stat label="Appointments this month" value={d.appointmentsThisMonth.toString()} />
        <Stat label="No-show rate (30d)" value={pct(d.noShowRate30d)} />
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 8px" }}>Appointment mix (30d)</p>
          {Object.keys(d.appointmentTypeBreakdown30d).length === 0 ? (
            <EmptyNote text="No appointments in the last 30 days." />
          ) : (
            Object.entries(d.appointmentTypeBreakdown30d).map(([type, count]) => (
              <RowBar key={type} label={APPOINTMENT_TYPE_LABELS[type as keyof typeof APPOINTMENT_TYPE_LABELS] ?? type} value={count} max={Math.max(...Object.values(d.appointmentTypeBreakdown30d))} />
            ))
          )}
        </div>
        <div style={{ flex: 1, minWidth: 280 }}>
          <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 8px" }}>Workload by pharmacist (30d)</p>
          {d.workloadByPharmacist.length === 0 ? (
            <EmptyNote text="No assigned appointments in the last 30 days." />
          ) : (
            d.workloadByPharmacist.map((w) => (
              <RowBar key={w.name} label={w.name} value={w.count} max={d.workloadByPharmacist[0].count} />
            ))
          )}
        </div>
      </div>

      <SectionHeading>Anticoagulation quality</SectionHeading>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 8 }}>
        <Stat label="Avg TTR (Rosendaal)" value={pct(d.avgTtr)} />
        <Stat label="Patients with TTR ≥65%" value={pct(d.ttrAbove65PctShare)} />
        <Stat label="Avg PINRR" value={pct(d.avgPinrr)} />
        <Stat label="Latest INR > 4.0" value={pct(d.highInrShare)} />
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 24px" }}>
        Based on {d.warfarinPatientsAssessed} warfarin patient{d.warfarinPatientsAssessed === 1 ? "" : "s"} with
        enough INR readings to compute TTR (needs ≥2 readings and a target range on record).
      </p>

      <SectionHeading>Risk & safety</SectionHeading>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <Stat label="Bleeding events (90d)" value={d.bleedingEvents90d.toString()} tone={d.bleedingEvents90d > 0 ? "danger" : undefined} />
        <Stat label="Clotting events (90d)" value={d.clottingEvents90d.toString()} tone={d.clottingEvents90d > 0 ? "warning" : undefined} />
        <Stat label="Avg HAS-BLED" value={d.avgHasBled?.toFixed(1) ?? "—"} />
        <Stat label="HAS-BLED ≥3 (high risk)" value={pct(d.highHasBledShare)} />
        <Stat label="Avg CHA2DS2-VASc" value={d.avgChadsVasc?.toFixed(1) ?? "—"} />
        <Stat label="CHA2DS2-VASc ≥2" value={pct(d.highChadsVascShare)} />
      </div>

      <div style={{ border: "0.5px solid var(--border)", borderRadius: 8, padding: 14, fontSize: 12, color: "var(--text-secondary)" }}>
        <p style={{ margin: "0 0 6px", fontWeight: 500, color: "var(--text-primary)" }}>Why these KPIs</p>
        <p style={{ margin: "0 0 6px" }}>
          Workload numbers (volume, no-show rate, per-pharmacist load) are the kind of thing a department head
          typically wants for staffing/capacity decisions. TTR and PINRR are the standard anticoagulation-clinic
          quality metrics in the literature — TTR ≥65–70% is a commonly cited benchmark for "good"
          warfarin control, which is why that threshold is used here; confirm it matches your own clinic's target
          before treating it as a pass/fail line. Bleeding/clotting event counts and the HAS-BLED/CHA2DS2-VASc
          distributions are the closest things this system has to a safety signal.
        </p>
        <p style={{ margin: 0 }}>
          Not built: trend-over-time charts (this is a snapshot as of today), and any risk-adjustment (a clinic
          with more complex patients will naturally look "worse" on some of these without that being a quality
          problem). Flag if either of those would actually be useful before they get built.
        </p>
      </div>
    </main>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15, fontWeight: 500, margin: "0 0 12px" }}>{children}</p>;
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

function RowBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ color: "var(--text-secondary)" }}>{value}</span>
      </div>
      <div style={{ background: "var(--surface-1)", borderRadius: 3, height: 6, overflow: "hidden" }}>
        <div style={{ background: "var(--fill-accent)", height: "100%", width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{text}</p>;
}
