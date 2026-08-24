import { createPatient } from "@/app/actions/patients";
import Link from "next/link";

export default function NewPatientPage() {
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
          <SelectField label="Sex" name="sex" options={["male", "female"]} />
        </Row>

        <Row>
          <Field label="Weight (kg)" name="weight_kg" type="number" step="0.1" />
          <Field label="Height (cm)" name="height_cm" type="number" step="0.1" />
        </Row>

        <SelectField
          label="Indication"
          name="indication"
          required
          options={["af_nonvalvular", "af_valvular", "mechanical_valve", "vte_dvt", "vte_pe", "other"]}
        />

        <SelectField
          label="Anticoagulant"
          name="anticoagulant_type"
          required
          options={["warfarin", "rivaroxaban", "apixaban", "dabigatran", "edoxaban", "other"]}
        />

        <Row>
          <Field label="Target INR low (warfarin only)" name="target_inr_low" type="number" step="0.1" />
          <Field label="Target INR high (warfarin only)" name="target_inr_high" type="number" step="0.1" />
        </Row>

        <Field label="Phone" name="phone" />
        <Field label="Address" name="address" />
        <SelectField label="Risk class" name="risk_class" options={["low", "medium", "high"]} />

        <button
          type="submit"
          style={{
            width: "100%",
            background: "var(--fill-primary)",
            color: "var(--on-primary)",
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
}: {
  label: string;
  name: string;
  options: string[];
  required?: boolean;
}) {
  return (
    <div style={{ flex: 1, marginBottom: 14 }}>
      <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
        {label}
      </label>
      <select name={name} required={required} style={{ width: "100%", height: 36 }}>
        <option value="">Select&hellip;</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </div>
  );
}
