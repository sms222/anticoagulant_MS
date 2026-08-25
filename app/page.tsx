import { getTodaysAppointments, getAllPatients, getFollowUpStatuses } from "@/lib/supabase/queries";
import { PatientSearch } from "@/components/home/PatientSearch";
import Link from "next/link";

export const dynamic = "force-dynamic";

const statusStyle: Record<string, { bg: string; text: string; label: string }> = {
  waiting: { bg: "var(--bg-warning)", text: "var(--text-warning)", label: "Waiting" },
  in_progress: { bg: "var(--bg-info)", text: "var(--text-info)", label: "In progress" },
  completed: { bg: "var(--bg-success)", text: "var(--text-success)", label: "Completed" },
  no_show: { bg: "var(--bg-danger)", text: "var(--text-danger)", label: "No-show" },
  cancelled: { bg: "var(--surface-1)", text: "var(--text-muted)", label: "Cancelled" },
};

export default async function Home() {
  const [appointments, patients, followUps] = await Promise.all([
    getTodaysAppointments(),
    getAllPatients(),
    getFollowUpStatuses(),
  ]);
  const today = new Date().toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long" });
  const todayIso = new Date().toISOString().slice(0, 10);
  const weekAheadIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const followUpByPatient = new Map(followUps.map((f) => [f.patient_id, f]));
  const activePatientIds = new Set(patients.map((p) => p.id));

  const defaulted = followUps
    .filter(
      (f) =>
        activePatientIds.has(f.patient_id) &&
        f.next_appt_date &&
        f.next_appt_date < todayIso
    )
    .map((f) => ({ f, patient: patients.find((p) => p.id === f.patient_id)! }))
    .sort((a, b) => (a.f.next_appt_date! < b.f.next_appt_date! ? -1 : 1));

  const upcomingDue = followUps
    .filter(
      (f) =>
        activePatientIds.has(f.patient_id) &&
        f.next_appt_date &&
        f.next_appt_date >= todayIso &&
        f.next_appt_date <= weekAheadIso
    )
    .map((f) => ({ f, patient: patients.find((p) => p.id === f.patient_id)! }))
    .sort((a, b) => (a.f.next_appt_date! < b.f.next_appt_date! ? -1 : 1));

  return (
    <main style={{ padding: "2rem", maxWidth: 1440, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Clinic overview</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>{today}</p>

      {(defaulted.length > 0 || upcomingDue.length > 0) && (
        <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
          {defaulted.length > 0 && (
            <AlertCard
              tone="danger"
              count={defaulted.length}
              label={defaulted.length === 1 ? "patient defaulted follow-up" : "patients defaulted follow-up"}
              items={defaulted.map(({ f, patient }) => ({
                id: patient.id,
                name: patient.name,
                detail: `Missed appt was ${f.next_appt_date}`,
              }))}
            />
          )}
          {upcomingDue.length > 0 && (
            <AlertCard
              tone="warning"
              count={upcomingDue.length}
              label={upcomingDue.length === 1 ? "check due within 7 days" : "checks due within 7 days"}
              items={upcomingDue.map(({ f, patient }) => ({
                id: patient.id,
                name: patient.name,
                detail: `Due ${f.next_appt_date}`,
              }))}
            />
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Today's queue</p>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {appointments.length} appointment{appointments.length === 1 ? "" : "s"}
        </span>
      </div>

      {appointments.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 32 }}>
          No appointments scheduled for today.
        </p>
      ) : (
        <div style={{ border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 32 }}>
          {appointments.map((a, i) => {
            const s = statusStyle[a.status] ?? statusStyle.waiting;
            return (
              <Link
                key={a.id}
                href={`/patients/${a.patient_id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "12px 16px",
                  borderBottom: i < appointments.length - 1 ? "0.5px solid var(--border)" : "none",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--text-secondary)", width: 56, flexShrink: 0 }}>
                  {a.scheduled_time?.slice(0, 5)}
                </span>
                <span style={{ flex: 1 }}>{a.patients?.name}</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 90 }}>
                  {a.patients?.anticoagulant_type}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 130 }}>{a.room}</span>
                <span
                  style={{
                    background: s.bg,
                    color: s.text,
                    fontSize: 12,
                    padding: "2px 10px",
                    borderRadius: 6,
                    flexShrink: 0,
                  }}
                >
                  {s.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>All active patients</p>
        <Link href="/patients/new" style={{ fontSize: 13, color: "var(--text-accent)", textDecoration: "none" }}>
          + Add patient
        </Link>
      </div>
      <PatientSearch patients={patients} />
    </main>
  );
}

function AlertCard({
  tone,
  count,
  label,
  items,
}: {
  tone: "danger" | "warning";
  count: number;
  label: string;
  items: { id: string; name: string; detail: string }[];
}) {
  const bg = tone === "danger" ? "var(--bg-danger)" : "var(--bg-warning)";
  const text = tone === "danger" ? "var(--text-danger)" : "var(--text-warning)";
  return (
    <div style={{ flex: 1, minWidth: 260, background: bg, borderRadius: 10, padding: "12px 14px" }}>
      <p style={{ margin: "0 0 8px", fontSize: 13, color: text, fontWeight: 500 }}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>{count}</span> {label}
      </p>
      <div>
        {items.slice(0, 4).map((item) => (
          <Link
            key={item.id}
            href={`/patients/${item.id}`}
            style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: text, textDecoration: "none", padding: "3px 0" }}
          >
            <span>{item.name}</span>
            <span style={{ opacity: 0.75 }}>{item.detail}</span>
          </Link>
        ))}
        {items.length > 4 && (
          <p style={{ fontSize: 11, color: text, opacity: 0.75, margin: "4px 0 0" }}>
            +{items.length - 4} more
          </p>
        )}
      </div>
    </div>
  );
}
