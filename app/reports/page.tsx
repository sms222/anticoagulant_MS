import Link from "next/link";
import { getClinicReportData } from "@/lib/supabase/queries";
import { APPOINTMENT_TYPE_LABELS } from "@/lib/types";
import { ReportTabs } from "@/components/reports/ReportTabs";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const d = await getClinicReportData();

  return (
    <main style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      <Link href="/" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>
        &larr; Back to dashboard
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 500, margin: "8px 0 4px" }}>Clinic reports</h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 24px" }}>
        Workload and quality KPIs, computed live from clinic data.
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

      <SectionHeading>Visit duration (pharmacist time with patient)</SectionHeading>
      <VisitDurationSection stats={d.visitDuration} />

      <SectionHeading>Anticoagulation quality &amp; safety</SectionHeading>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
        Combined view is all active patients; Warfarin and NOAC break the same metrics out by drug class. TTR/PINRR
        only apply to warfarin (no routine level monitoring on NOACs), so those read as &mdash; on the NOAC tab.
      </p>
      <ReportTabs combined={d.combined} warfarin={d.warfarin} noac={d.noac} noacDoseGroups={d.noacDoseGroups} />
    </main>
  );
}

function pct(v: number | null) {
  return v === null ? "—" : `${v.toFixed(0)}%`;
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

function VisitDurationSection({
  stats,
}: {
  stats: { count: number; meanMinutes: number | null; medianMinutes: number | null; sdMinutes: number | null; histogram: { bucketLabel: string; count: number }[] };
}) {
  if (stats.count === 0) {
    return (
      <div style={{ marginBottom: 24 }}>
        <EmptyNote text="No completed visits with a recorded duration yet — timers start recording once pharmacists use Start/Save & End Visit on the queue." />
      </div>
    );
  }
  const maxCount = Math.max(...stats.histogram.map((b) => b.count), 1);
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 12 }}>
        <Stat label="Visits timed" value={stats.count.toString()} />
        <Stat label="Mean duration" value={`${stats.meanMinutes!.toFixed(1)} min`} />
        <Stat label="Median duration" value={`${stats.medianMinutes!.toFixed(1)} min`} />
        <Stat label="SD (dispersion)" value={`±${stats.sdMinutes!.toFixed(1)} min`} />
      </div>
      <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 8px" }}>Distribution</p>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100, border: "0.5px solid var(--border)", borderRadius: 8, padding: "12px 14px" }}>
        {stats.histogram.map((b) => (
          <div key={b.bucketLabel} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, justifyContent: "flex-end", height: "100%" }}>
            <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>{b.count}</span>
            <div style={{ width: "100%", background: "var(--fill-accent)", borderRadius: 3, height: `${(b.count / maxCount) * 60}px`, minHeight: b.count > 0 ? 3 : 0 }} />
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{b.bucketLabel}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "6px 0 0" }}>Minutes per visit, bucketed.</p>
    </div>
  );
}
