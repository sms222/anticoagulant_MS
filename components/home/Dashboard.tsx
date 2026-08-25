"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { TodaysAppointment, Patient, FollowUpStatus, Pharmacist, AppointmentType } from "@/lib/types";
import { APPOINTMENT_TYPE_LABELS } from "@/lib/types";
import { formatDateDisplay } from "@/lib/format";
import { checkInAppointment, startVisit, completeAppointment, markNoShow } from "@/app/actions/appointments";

const statusMeta: Record<string, { bg: string; text: string; label: string }> = {
  scheduled: { bg: "var(--bg-info)", text: "var(--text-info)", label: "Scheduled" },
  checked_in: { bg: "var(--bg-warning)", text: "var(--text-warning)", label: "Checked-In" },
  with_pharmacist: { bg: "var(--bg-accent)", text: "var(--text-accent)", label: "With Pharmacist" },
  completed: { bg: "var(--bg-success)", text: "var(--text-success)", label: "Completed" },
  no_show: { bg: "var(--bg-danger)", text: "var(--text-danger)", label: "No-show" },
  cancelled: { bg: "var(--surface-1)", text: "var(--text-muted)", label: "Cancelled" },
};

const typeColors: Record<AppointmentType, string> = {
  routine_followup: "#a3161a",
  telephone_followup: "#e0959a",
  urgent_walkin: "#5c1214",
};

const cardStyle: React.CSSProperties = {
  background: "var(--surface-0)",
  borderRadius: 12,
  border: "0.5px solid var(--border)",
  padding: 16,
};

export function Dashboard({
  appointments,
  tomorrowAppointments,
  patients,
  followUps,
  highInrAlerts,
  pharmacists,
  currentPharmacist,
  selectedDate,
}: {
  appointments: TodaysAppointment[];
  tomorrowAppointments: TodaysAppointment[];
  patients: Patient[];
  followUps: FollowUpStatus[];
  highInrAlerts: { patient_id: string; name: string; last_inr: number }[];
  pharmacists: Pharmacist[];
  currentPharmacist: Pharmacist | null;
  selectedDate: string;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const defaulted = followUps.filter((f) => f.next_appt_date && f.next_appt_date < todayIso);

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 54px)", background: "var(--surface-1)" }}>
      <LeftNav />
      <main style={{ flex: 1, padding: "24px 28px", minWidth: 0 }}>
        <HeaderBar currentPharmacist={currentPharmacist} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16, marginBottom: 20 }}>
          <OverviewCard appointments={appointments} />
          <AlertsCard highInrAlerts={highInrAlerts} defaultedCount={defaulted.length} defaulted={defaulted} />
          <AppointmentTypeCard appointments={appointments} />
          <QuickSearchCard patients={patients} />
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: 2, minWidth: 480 }}>
            <AppointmentsTable appointments={appointments} pharmacists={pharmacists} selectedDate={selectedDate} todayIso={todayIso} />
          </div>
          <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 16 }}>
            <MiniCalendar selectedDate={selectedDate} todayIso={todayIso} />
            <UpcomingPanel appointments={appointments} tomorrowAppointments={tomorrowAppointments} selectedDate={selectedDate} todayIso={todayIso} />
          </div>
        </div>
      </main>
    </div>
  );
}

function LeftNav() {
  const linkStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 13,
    textDecoration: "none",
    color: "var(--text-secondary)",
  };
  return (
    <div style={{ width: 200, flexShrink: 0, borderRight: "0.5px solid var(--border)", padding: "20px 12px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div>
        <Link href="/" style={{ ...linkStyle, background: "var(--bg-accent)", color: "var(--text-accent)", fontWeight: 500 }}>
          Dashboard
        </Link>
        <Link href="/patients" style={linkStyle}>
          Patients
        </Link>
        <Link href="/reports" style={linkStyle}>
          Reports
        </Link>
      </div>
      <div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 0.4 }}>
          Quick actions
        </p>
        <Link href="/appointments/new" style={linkStyle}>
          + Create appointment
        </Link>
        <Link href="/patients/new" style={linkStyle}>
          + Add new patient
        </Link>
        <Link href="/patients" style={linkStyle}>
          + Log INR result
        </Link>
      </div>
    </div>
  );
}

function HeaderBar({ currentPharmacist }: { currentPharmacist: Pharmacist | null }) {
  const today = new Date().toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <div>
        <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>Anticoagulant Clinic Dashboard</p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "2px 0 0" }}>{today}</p>
      </div>
      {currentPharmacist && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--fill-accent)",
              color: "var(--on-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {currentPharmacist.full_name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: 13, margin: 0 }}>{currentPharmacist.full_name}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>Pharmacist</p>
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewCard({ appointments }: { appointments: TodaysAppointment[] }) {
  const total = appointments.length;
  const completed = appointments.filter((a) => a.status === "completed").length;
  const pending = appointments.filter((a) => a.status === "scheduled").length;
  const checkedIn = appointments.filter((a) => a.status === "checked_in" || a.status === "with_pharmacist").length;

  return (
    <div style={cardStyle}>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 10px", fontWeight: 500 }}>Today's Overview</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <StatBlock value={total} label="Total appointments" />
        <StatBlock value={completed} label="Completed" />
        <StatBlock value={pending} label="Pending" />
        <StatBlock value={checkedIn} label="Checked-in" />
      </div>
    </div>
  );
}

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p style={{ fontSize: 22, fontWeight: 600, margin: 0, color: "var(--text-accent)" }}>{value}</p>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{label}</p>
    </div>
  );
}

function AlertsCard({
  highInrAlerts,
  defaultedCount,
  defaulted,
}: {
  highInrAlerts: { patient_id: string; name: string; last_inr: number }[];
  defaultedCount: number;
  defaulted: FollowUpStatus[];
}) {
  return (
    <div style={cardStyle}>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 10px", fontWeight: 500 }}>High Priority Alerts</p>
      <AlertRow icon="!" tone="danger" text={`${highInrAlerts.length} Patient${highInrAlerts.length === 1 ? "" : "s"} with INR > 4.0`}>
        {highInrAlerts.slice(0, 3).map((a) => (
          <p key={a.patient_id} style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0 22px" }}>
            {a.name} - INR {a.last_inr}
          </p>
        ))}
      </AlertRow>
      <AlertRow icon="#" tone="warning" text={`${defaultedCount} Patient${defaultedCount === 1 ? "" : "s"} defaulted follow-up`}>
        {defaulted.slice(0, 3).map((f) => (
          <p key={f.patient_id} style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0 22px" }}>
            {f.patient_name} - missed {formatDateDisplay(f.next_appt_date)}
          </p>
        ))}
      </AlertRow>
      <AlertRow icon="o" tone="muted" text="Overdue dose adjustments" placeholder />
      <AlertRow icon="o" tone="muted" text="New referrals pending review" placeholder />
    </div>
  );
}

function AlertRow({
  icon,
  tone,
  text,
  placeholder,
  children,
}: {
  icon: string;
  tone: "danger" | "warning" | "muted";
  text: string;
  placeholder?: boolean;
  children?: React.ReactNode;
}) {
  const color = tone === "danger" ? "var(--text-danger)" : tone === "warning" ? "var(--text-warning)" : "var(--text-muted)";
  const badgeBg = tone === "danger" ? "var(--bg-danger)" : tone === "warning" ? "var(--bg-warning)" : "var(--surface-1)";
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: badgeBg,
            color,
            fontSize: 10,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <span style={{ fontSize: 12, color, fontWeight: placeholder ? 400 : 500 }}>
          {text}
          {placeholder && <span style={{ color: "var(--text-muted)" }}> - not tracked yet</span>}
        </span>
      </div>
      {children}
    </div>
  );
}

function AppointmentTypeCard({ appointments }: { appointments: TodaysAppointment[] }) {
  const counts: Record<AppointmentType, number> = { routine_followup: 0, telephone_followup: 0, urgent_walkin: 0 };
  appointments.forEach((a) => {
    counts[a.appointment_type] = (counts[a.appointment_type] ?? 0) + 1;
  });
  const total = appointments.length || 1;
  const types = Object.keys(counts) as AppointmentType[];
  let cursor = 0;
  const stops = types
    .map((t) => {
      const pct = (counts[t] / total) * 100;
      const segment = `${typeColors[t]} ${cursor}% ${cursor + pct}%`;
      cursor += pct;
      return segment;
    })
    .join(", ");

  return (
    <div style={cardStyle}>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 10px", fontWeight: 500 }}>Appointments Status</p>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 70,
            height: 70,
            borderRadius: "50%",
            background: appointments.length > 0 ? `conic-gradient(${stops})` : "var(--surface-1)",
            flexShrink: 0,
          }}
        />
        <div>
          {types.map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: typeColors[t], flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {APPOINTMENT_TYPE_LABELS[t]} ({counts[t]})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickSearchCard({ patients }: { patients: Patient[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q ? patients.filter((p) => p.name.toLowerCase().includes(q) || (p.mrn ?? "").toLowerCase().includes(q)).slice(0, 5) : [];

  return (
    <div style={cardStyle}>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 10px", fontWeight: 500 }}>Quick Search</p>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search patients by name or ID"
        style={{ width: "100%" }}
      />
      {matches.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {matches.map((p) => (
            <Link
              key={p.id}
              href={`/patients/${p.id}`}
              style={{ display: "block", fontSize: 12, color: "var(--text-accent)", textDecoration: "none", padding: "4px 0" }}
            >
              {p.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniCalendar({ selectedDate, todayIso }: { selectedDate: string; todayIso: string }) {
  const [viewYear, viewMonth] = selectedDate.split("-").map(Number);
  const year = viewYear;
  const month = viewMonth - 1;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function isoFor(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, fontWeight: 500 }}>{monthLabel}</p>
        {selectedDate !== todayIso && (
          <Link href={`/?date=${todayIso}`} style={{ fontSize: 11, color: "var(--text-accent)", textDecoration: "none" }}>
            Today
          </Link>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, fontSize: 10, textAlign: "center" }}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <span key={d} style={{ color: "var(--text-muted)" }}>
            {d}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const iso = isoFor(d);
          const isToday = iso === todayIso;
          const isSelected = iso === selectedDate;
          return (
            <Link
              key={i}
              href={`/?date=${iso}`}
              style={{
                padding: "3px 0",
                borderRadius: 4,
                textDecoration: "none",
                background: isSelected ? "var(--fill-accent)" : isToday ? "var(--bg-accent)" : "transparent",
                color: isSelected ? "var(--on-accent)" : "var(--text-primary)",
                border: isToday && !isSelected ? "1px solid var(--border-accent)" : "1px solid transparent",
              }}
            >
              {d}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function UpcomingPanel({
  appointments,
  tomorrowAppointments,
  selectedDate,
  todayIso,
}: {
  appointments: TodaysAppointment[];
  tomorrowAppointments: TodaysAppointment[];
  selectedDate: string;
  todayIso: string;
}) {
  if (selectedDate !== todayIso) {
    return (
      <div style={cardStyle}>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 4px", fontWeight: 500 }}>Upcoming Appointments</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Only shown when viewing today.</p>
      </div>
    );
  }

  const now = new Date();
  const nowHM = now.toTimeString().slice(0, 5);
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000).toTimeString().slice(0, 5);
  const laterToday = appointments
    .filter((a) => a.status === "scheduled" && a.scheduled_time.slice(0, 5) >= nowHM && a.scheduled_time.slice(0, 5) <= twoHoursLater)
    .slice(0, 5);
  const tomorrow = tomorrowAppointments.filter((a) => a.status === "scheduled").slice(0, 5);

  return (
    <div style={cardStyle}>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 4px", fontWeight: 500 }}>Upcoming Appointments</p>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px" }}>Next two hours today, plus tomorrow's schedule.</p>

      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 6px", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3 }}>
        Later today
      </p>
      {laterToday.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>Nothing coming up in this window.</p>
      ) : (
        <div style={{ marginBottom: 12 }}>
          {laterToday.map((a) => (
            <div key={a.id} style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 12, margin: 0 }}>{a.patient_name}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                {a.scheduled_time.slice(0, 5)} - {APPOINTMENT_TYPE_LABELS[a.appointment_type]}
              </p>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 6px", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3 }}>
        Tomorrow
      </p>
      {tomorrow.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Nothing scheduled yet.</p>
      ) : (
        tomorrow.map((a) => (
          <div key={a.id} style={{ marginBottom: 8 }}>
            <p style={{ fontSize: 12, margin: 0 }}>{a.patient_name}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
              {a.scheduled_time.slice(0, 5)} - {APPOINTMENT_TYPE_LABELS[a.appointment_type]}
            </p>
          </div>
        ))
      )}
    </div>
  );
}

function AppointmentsTable({
  appointments,
  pharmacists,
  selectedDate,
  todayIso,
}: {
  appointments: TodaysAppointment[];
  pharmacists: Pharmacist[];
  selectedDate: string;
  todayIso: string;
}) {
  const title = selectedDate === todayIso ? "Today's Appointments" : `Appointments — ${formatDateDisplay(selectedDate)}`;
  return (
    <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
      <p style={{ fontSize: 13, fontWeight: 500, margin: 0, padding: "14px 16px", borderBottom: "0.5px solid var(--border)" }}>
        {title}
      </p>
      {appointments.length === 0 ? (
        <p style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
          No appointments on this date.
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)", textAlign: "left" }}>
              <th style={th}>Time</th>
              <th style={th}>Patient</th>
              <th style={th}>Medication</th>
              <th style={th}>Target INR</th>
              <th style={th}>Last INR</th>
              <th style={th}>Status</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <AppointmentRow key={a.id} appt={a} pharmacists={pharmacists} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "8px 12px", fontWeight: 500, color: "var(--text-secondary)" };
const td: React.CSSProperties = { padding: "10px 12px", borderTop: "0.5px solid var(--border)", verticalAlign: "top" };

function inrColor(value: number | null, low: number | null, high: number | null) {
  if (value === null) return "var(--text-muted)";
  if (value > 4.0) return "var(--text-danger)";
  if (low !== null && high !== null && value >= low && value <= high) return "var(--text-success)";
  return "var(--text-warning)";
}

function AppointmentRow({ appt, pharmacists }: { appt: TodaysAppointment; pharmacists: Pharmacist[] }) {
  const [showStartForm, setShowStartForm] = useState(false);
  const meta = statusMeta[appt.status] ?? statusMeta.scheduled;
  const boundCheckIn = checkInAppointment.bind(null, appt.id);
  const boundComplete = completeAppointment.bind(null, appt.id);
  const boundNoShow = markNoShow.bind(null, appt.id);
  const boundStart = startVisit.bind(null, appt.id, appt.patient_id);

  return (
    <tr>
      <td style={td}>{appt.scheduled_time.slice(0, 5)}</td>
      <td style={td}>
        <Link href={`/patients/${appt.patient_id}`} style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: 500 }}>
          {appt.patient_name}
        </Link>
        {appt.status === "with_pharmacist" && (
          <p style={{ fontSize: 11, color: "var(--text-accent)", margin: "2px 0 0" }}>
            Meeting {appt.pharmacist_name ?? "-"} in {appt.room ?? "-"}
          </p>
        )}
      </td>
      <td style={{ ...td, textTransform: "capitalize" }}>{appt.anticoagulant_type}</td>
      <td style={td}>{appt.target_inr_low && appt.target_inr_high ? `${appt.target_inr_low}-${appt.target_inr_high}` : "-"}</td>
      <td style={{ ...td, color: inrColor(appt.last_inr, appt.target_inr_low, appt.target_inr_high), fontWeight: 500 }}>
        {appt.last_inr ?? "-"}
      </td>
      <td style={td}>
        <span style={{ background: meta.bg, color: meta.text, fontSize: 11, padding: "2px 8px", borderRadius: 6 }}>{meta.label}</span>
      </td>
      <td style={{ ...td, minWidth: 190 }}>
        {appt.status === "scheduled" && (
          <div style={{ display: "flex", gap: 6 }}>
            <form action={boundCheckIn}>
              <ActionButton>Check In</ActionButton>
            </form>
            <form action={boundNoShow}>
              <ActionButton danger>No-show</ActionButton>
            </form>
          </div>
        )}
        {appt.status === "checked_in" && !showStartForm && (
          <ActionButton onClick={() => setShowStartForm(true)}>
            {appt.visit_elapsed_seconds > 0 ? `Resume Visit (${formatDuration(appt.visit_elapsed_seconds)} so far)` : "Start Visit"}
          </ActionButton>
        )}
        {appt.status === "checked_in" && showStartForm && (
          <form
            action={async (fd) => {
              await boundStart(fd);
              setShowStartForm(false);
            }}
            style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}
          >
            <input name="room" placeholder="Room" defaultValue={appt.room ?? ""} style={{ width: 80, fontSize: 11, padding: "3px 6px" }} />
            <select name="pharmacist_id" defaultValue={appt.pharmacist_id ?? ""} style={{ width: 100, fontSize: 11, padding: "3px 6px" }}>
              <option value="">Pharmacist</option>
              {pharmacists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
            <ActionButton type="submit">Go</ActionButton>
          </form>
        )}
        {appt.status === "with_pharmacist" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <VisitTimer startedAt={appt.visit_started_at} elapsedSeconds={appt.visit_elapsed_seconds} />
            <form action={boundComplete}>
              <ActionButton>Save &amp; End Visit</ActionButton>
            </form>
          </div>
        )}
        <Link href={`/patients/${appt.patient_id}`} style={{ fontSize: 11, color: "var(--text-accent)", marginLeft: 8, textDecoration: "none" }}>
          View Details
        </Link>
      </td>
    </tr>
  );
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Client-side ticking clock — elapsed = banked seconds from any prior
// pause/resume cycle + time since this run's visit_started_at. Only one of
// these can be "with_pharmacist" per pharmacist at a time (enforced server-side
// in startVisit), so there's never more than one ticking timer per pharmacist.
function VisitTimer({ startedAt, elapsedSeconds }: { startedAt: string | null; elapsedSeconds: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const ranSeconds = startedAt ? Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 1000)) : 0;
  const total = elapsedSeconds + ranSeconds;

  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: "var(--text-accent)",
        background: "var(--bg-accent)",
        padding: "3px 8px",
        borderRadius: 6,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {formatDuration(total)}
    </span>
  );
}

function ActionButton({
  children,
  danger,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      {...rest}
      type={rest.type ?? "submit"}
      style={{
        fontSize: 11,
        padding: "4px 9px",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        background: danger ? "var(--bg-danger)" : "var(--surface-1)",
        color: danger ? "var(--text-danger)" : "var(--text-primary)",
      }}
    >
      {children}
    </button>
  );
}
