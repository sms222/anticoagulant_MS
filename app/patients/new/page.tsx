"use client";

import { useState } from "react";
import { createPatient } from "@/app/actions/patients";
import { INDICATION_OPTIONS } from "@/lib/types";
import Link from "next/link";

export default function NewPatientPage() {
  const [indication, setIndication] = useState("");
  const [anticoagulant, setAnticoagulant] = useState("");
  const isWarfarin = anticoagulant === "warfarin";

  return (
    <main style={{ padding: "2rem", maxWidth: 640, margin: "0 auto" }}>
      <Link href="/" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>
        &larr; Back to list
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 500, margin: "8px 0 24px" }}>Add patient</h1>

      <form action={createPatient}>
        <Field label="Full name" name="name" required />

        <Row>
          <Field label="Date of birth" name="date_of_birth" type="date" />
          <SelectField label="Sex" name="sex" options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
        </Row>

        <Row>
          <Field label="Weight (kg)" name="weight_kg" type="number" step="0.1" />
          <Field label="Height (cm)" name="height_cm" type="number" step="0.1" />
        </Row>

        <SelectField
          label="Indication"
          name="indication"
          required
          options={INDICATION_OPTIONS}
          value={indication}
          onChange={setIndication}
        />
        {indication === "other" && (
          <Field label="Indication (free text)" name="indication_detail" required />
        )}

        <SelectField
          label="Anticoagulant"
          name="anticoagulant_type"
          required
          options={[
            { value: "warfarin", label: "Warfarin" },
            { value: "rivaroxaban", label: "Rivaroxaban" },
            { value: "apixaban", label: "Apixaban" },
            { value: "dabigatran", label: "Dabigatran" },
            { value: "edoxaban", label: "Edoxaban" },
            { value: "other", label: "Other" },
          ]}
          value={anticoagulant}
          onChange={setAnticoagulant}
        />

        {isWarfarin && (
          <div style={{ marginBottom: 14 }}>
            <Field label="Target INR" name="target_inr" type="number" step="0.1" />
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "-8px 0 0" }}>
              Range applied automatically: \u00b10.5 (e.g. 2.5 \u2192 2.0\u20133.0). Can be updated at a later
              visit \u2014 changes are tracked and feed the TTR graph.
            </p>
          </div>
        )}

        <Field label="Phone" name="phone" />
        <Field label="Address" name="address" />

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
            Notes
          </label>
          <textarea name="notes" rows={4} style={{ width: "100%", resize: "vertical" }} />
        </div>

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
          Create patient
        </button>
      </form>
    </main>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 12 }}>{children}</div>;
}

function Field({
  label,
  name,
  type = "text",
  required,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  step?: string;
}) {
  return (
    <div style={{ flex: 1, marginBottom: 14 }}>
      <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
        {label}
      </label>
      <input name={name} type={type} required={required} step={step} style={{ width: "100%", height: 36 }} />
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  required,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  required?: boolean;
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <div style={{ flex: 1, marginBottom: 14 }}>
      <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
        {label}
      </label>
      <select
        name={name}
        required={required}
        style={{ width: "100%", height: 36 }}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      >
        <option value="">Select&hellip;</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
