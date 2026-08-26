"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { previewPatientImport, commitPatientImport } from "@/app/actions/patient-import";
import type { ImportPreview } from "@/lib/patient-import/types";

type Stage =
  | { step: "upload" }
  | { step: "select-sheet"; file: File; sheets: string[] }
  | { step: "preview"; file: File; preview: ImportPreview }
  | { step: "committing" }
  | { step: "done"; patientId: string };

export default function ExcelImportPanel() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ step: "upload" });
  const [error, setError] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, "sheet" | "system">>({});
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function runPreview(file: File, sheet?: string) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      if (sheet) fd.set("sheet", sheet);
      const result = await previewPatientImport(fd);
      if (result.needsSheetSelection) {
        setStage({ step: "select-sheet", file, sheets: result.sheets });
      } else {
        const defaults: Record<string, "sheet" | "system"> = {};
        for (const c of result.preview.conflicts) defaults[c.field] = "sheet";
        setResolutions(defaults);
        setStage({ step: "preview", file, preview: result.preview });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file.");
      setStage({ step: "upload" });
    } finally {
      setBusy(false);
    }
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    runPreview(file);
  }

  async function onConfirm() {
    if (stage.step !== "preview") return;
    setBusy(true);
    setError(null);
    try {
      const { patientId } = await commitPatientImport({
        mode: stage.preview.mode,
        existingPatientId: stage.preview.existingPatientId,
        parsed: stage.preview.parsed,
        resolutions,
        conflicts: stage.preview.conflicts,
      });
      setStage({ step: "done", patientId });
      router.push(`/patients/${patientId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this patient.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStage({ step: "upload" });
    setResolutions({});
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div>
      {error && (
        <div style={{ background: "#FDECEC", color: "#7A1F2B", padding: 10, borderRadius: 6, marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      {stage.step === "upload" && (
        <div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
            Upload one patient&apos;s completed sheet from the migration template (one tab per patient). If the
            workbook has several patient tabs, you&apos;ll be asked which one to import.
          </p>
          <input ref={fileInputRef} type="file" accept=".xlsx" onChange={onFileChosen} disabled={busy} />
          {busy && <p style={{ fontSize: 13, marginTop: 8 }}>Reading file&hellip;</p>}
        </div>
      )}

      {stage.step === "select-sheet" && (
        <div>
          <p style={{ fontSize: 13, marginBottom: 10 }}>This workbook has several patient tabs. Which one?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {stage.sheets.map((s) => (
              <button
                key={s}
                onClick={() => runPreview(stage.file, s)}
                disabled={busy}
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "white",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <SmallLink onClick={reset}>Cancel</SmallLink>
        </div>
      )}

      {stage.step === "preview" && (
        <PreviewScreen
          preview={stage.preview}
          resolutions={resolutions}
          setResolutions={setResolutions}
          onConfirm={onConfirm}
          onCancel={reset}
          busy={busy}
        />
      )}
    </div>
  );
}

function SmallLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{ background: "none", border: "none", color: "var(--text-accent)", fontSize: 13, cursor: "pointer", padding: 0 }}
    >
      {children}
    </button>
  );
}

function PreviewScreen({
  preview,
  resolutions,
  setResolutions,
  onConfirm,
  onCancel,
  busy,
}: {
  preview: ImportPreview;
  resolutions: Record<string, "sheet" | "system">;
  setResolutions: (r: Record<string, "sheet" | "system">) => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const hasHardErrors = preview.errors.length > 0;

  function setAll(v: "sheet" | "system") {
    const next: Record<string, "sheet" | "system"> = {};
    for (const c of preview.conflicts) next[c.field] = v;
    setResolutions(next);
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <span
          style={{
            display: "inline-block",
            fontSize: 12,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 4,
            background: preview.mode === "new" ? "#E8F0FE" : "#FFF2AC",
            color: preview.mode === "new" ? "#1A4EA0" : "#7A1F2B",
          }}
        >
          {preview.mode === "new" ? "New patient" : "Existing patient — MRN match found"}
        </span>
        <span style={{ marginLeft: 10, fontSize: 13, color: "var(--text-secondary)" }}>
          {preview.parsed.name} {preview.parsed.mrn ? `· MRN ${preview.parsed.mrn}` : ""}
        </span>
      </div>

      {hasHardErrors && (
        <div style={{ background: "#FDECEC", color: "#7A1F2B", padding: 10, borderRadius: 6, marginBottom: 14, fontSize: 13 }}>
          <strong>This sheet can&apos;t be imported yet:</strong>
          <ul style={{ margin: "6px 0 0 18px" }}>
            {preview.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {preview.autoFill.length > 0 && (
        <Section title="Will be filled in (system had nothing for these)">
          <table style={tableStyle}>
            <tbody>
              {preview.autoFill.map((f) => (
                <tr key={f.field}>
                  <td style={tdLabel}>{f.label}</td>
                  <td style={tdValue}>{f.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {preview.conflicts.length > 0 && (
        <Section
          title={`Differences to review (${preview.conflicts.length})`}
          action={
            <div style={{ display: "flex", gap: 8 }}>
              <SmallLink onClick={() => setAll("sheet")}>Keep all from sheet</SmallLink>
              <SmallLink onClick={() => setAll("system")}>Keep all from system</SmallLink>
            </div>
          }
        >
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Field</th>
                <th style={thStyle}>Sheet</th>
                <th style={thStyle}>System</th>
                <th style={thStyle}>Keep</th>
              </tr>
            </thead>
            <tbody>
              {preview.conflicts.map((c) => (
                <tr key={c.field}>
                  <td style={tdLabel}>{c.label}</td>
                  <td style={tdValue}>{c.sheetValue}</td>
                  <td style={tdValue}>{c.systemValue}</td>
                  <td>
                    <label style={{ marginRight: 10, fontSize: 12 }}>
                      <input
                        type="radio"
                        name={`resolve-${c.field}`}
                        checked={resolutions[c.field] === "sheet"}
                        onChange={() => setResolutions({ ...resolutions, [c.field]: "sheet" })}
                      />{" "}
                      Sheet
                    </label>
                    <label style={{ fontSize: 12 }}>
                      <input
                        type="radio"
                        name={`resolve-${c.field}`}
                        checked={resolutions[c.field] === "system"}
                        onChange={() => setResolutions({ ...resolutions, [c.field]: "system" })}
                      />{" "}
                      System
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {preview.conflicts.length === 0 && preview.mode === "existing" && (
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>
          No conflicting fields — everything on the sheet either matches the system or fills a blank.
        </p>
      )}

      <Section title={`INR history rows to add (${preview.inrRowCount})`}>
        {preview.inrRowCount === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>None on this sheet.</p>
        ) : (
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {preview.inrRowCount} reading{preview.inrRowCount === 1 ? "" : "s"} will be added. Repeats on the same date
            are kept, not merged.
          </p>
        )}
      </Section>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button
          onClick={onConfirm}
          disabled={busy || hasHardErrors}
          style={{
            background: hasHardErrors ? "#ccc" : "var(--fill-accent)",
            color: "var(--on-accent)",
            border: "none",
            padding: "10px 16px",
            fontSize: 14,
            fontWeight: 500,
            borderRadius: "var(--radius)",
            cursor: hasHardErrors ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Saving…" : preview.mode === "new" ? "Create patient" : "Save changes"}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          style={{ background: "none", border: "1px solid var(--border)", padding: "10px 16px", borderRadius: "var(--radius)", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "var(--text-secondary)" }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const thStyle: React.CSSProperties = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", fontWeight: 500 };
const tdLabel: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid var(--border)", fontWeight: 500 };
const tdValue: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid var(--border)" };
