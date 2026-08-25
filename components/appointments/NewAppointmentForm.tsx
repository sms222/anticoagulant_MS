"use client";

import Link from "next/link";
import { createAppointment } from "@/app/actions/appointments";
import type { Patient, Pharmacist } from "@/lib/types";
import { APPOINTMENT_TYPE_LABELS } from "@/lib/types";
import { TIME_OPTIONS } from "@/lib/format";

export function NewAppointmentForm({ patients, pharmacists }: { patients: Patient[]; pharmacists: Pharmacist[] }) {
  return (
    <div>
      <Link href="/" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>
        &larr; Back to dashboard
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 500, margin: "8px 0 24px" }}>Create appointment</h1>

      <form action={createAppointment}>
        <FieldWrap>
          <label style={label}>Patient</label>
          <select name="patient_id" required style={{ width: "100%" }}>
            <option value="">Select a patient&hellip;</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </FieldWrap>

        <Row>
          <FieldWrap>
            <label style={label}>Date</label>
            <input name="scheduled_date" type="date" required style={{ width: "100%", height: 36 }} />
          </FieldWrap>
          <FieldWrap>
            <label style={label}>Time</label>
            <select name="scheduled_time" required style={{ width: "100%", height: 36 }}>
              <option value="">Select&hellip;</option>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FieldWrap>
        </Row>

        <Row>
          <FieldWrap>
            <label style={label}>Room</label>
            <input name="room" placeholder="e.g. AC Clinic Room 2" style={{ width: "100%", height: 36 }} />
          </FieldWrap>
          <FieldWrap>
            <label style={label}>Pharmacist</label>
            <select name="pharmacist_id" style={{ width: "100%", height: 36 }}>
              <option value="">Unassigned</option>
              {pharmacists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </FieldWrap>
        </Row>

        <FieldWrap>
          <label style={label}>Appointment type</label>
          <select name="appointment_type" defaultValue="routine_followup" style={{ width: "100%", height: 36 }}>
            {Object.entries(APPOINTMENT_TYPE_LABELS).map(([value, l]) => (
              <option key={value} value={value}>
                {l}
              </option>
            ))}
          </select>
        </FieldWrap>

        <button
          type="submit"
          style={{
            width: "100%",
            background: "var(--fill-accent)",
            color: "var(--on-accent)",
            border: "none",
            padding: 10,
            fontSize: 14,
            fontWeight: 500,
            borderRadius: "var(--radius)",
            cursor: "pointer",
            marginTop: 8,
          }}
        >
          Create appointment
        </button>
      </form>
    </div>
  );
}

const label: React.CSSProperties = { fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 };

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 12 }}>{children}</div>;
}

function FieldWrap({ children }: { children: React.ReactNode }) {
  return <div style={{ flex: 1, marginBottom: 14 }}>{children}</div>;
}
