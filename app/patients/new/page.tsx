"use client";

import { useState } from "react";
import Link from "next/link";
import ManualPatientForm from "@/components/patients/ManualPatientForm";
import ExcelImportPanel from "@/components/patients/ExcelImportPanel";

type Tab = "manual" | "excel";

export default function NewPatientPage() {
  const [tab, setTab] = useState<Tab>("manual");

  return (
    <main style={{ padding: "2rem", maxWidth: 760, margin: "0 auto" }}>
      <Link href="/" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>
        &larr; Back to list
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 500, margin: "8px 0 20px" }}>Add patient</h1>

      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)" }}>
        <TabButton active={tab === "manual"} onClick={() => setTab("manual")}>
          Add manually
        </TabButton>
        <TabButton active={tab === "excel"} onClick={() => setTab("excel")}>
          Upload from Excel
        </TabButton>
      </div>

      {tab === "manual" ? <ManualPatientForm /> : <ExcelImportPanel />}
    </main>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        borderBottom: active ? "2px solid var(--fill-accent)" : "2px solid transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        fontWeight: active ? 600 : 400,
        fontSize: 14,
        padding: "8px 4px",
        marginRight: 16,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
