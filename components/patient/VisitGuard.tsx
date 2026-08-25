"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ActiveVisit } from "@/lib/types";
import { completeAppointment } from "@/app/actions/appointments";

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Shows the ticking timer for this patient's in-progress visit (top-right of
// the chart header) and asks before letting the pharmacist navigate away —
// "No" just lets them go, the timer keeps running server-side regardless.
//
// Known limitation: this only catches in-app link/button navigation (clicks
// intercepted in the capture phase). Closing the tab or hitting browser
// back/forward triggers the browser's own generic "leave site?" prompt
// instead (via beforeunload) — browsers don't allow a custom Yes/No/Cancel
// dialog or a reliable async server call at that point, so there's no way to
// offer the same "end appointment" choice there. The 2-hour auto-stop is the
// safety net for whatever slips through that gap.
export function VisitGuard({ activeVisit }: { activeVisit: ActiveVisit | null }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeVisit) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeVisit]);

  useEffect(() => {
    if (!activeVisit) return;

    function onClickCapture(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const url = new URL(anchor.href, window.location.origin);
      if (url.origin !== window.location.origin) return; // external link, don't intercept
      if (url.pathname === window.location.pathname) return; // same page (e.g. hash/tab state)
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(url.pathname + url.search);
    }

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [activeVisit]);

  useEffect(() => {
    if (!activeVisit) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [activeVisit]);

  if (!activeVisit) return null;

  const ranSeconds = Math.max(0, Math.round((now - new Date(activeVisit.visitStartedAt).getTime()) / 1000));
  const total = activeVisit.visitElapsedSeconds + ranSeconds;

  async function handleEndAndLeave() {
    setEnding(true);
    try {
      await completeAppointment(activeVisit!.appointmentId);
    } finally {
      if (pendingHref) router.push(pendingHref);
      setPendingHref(null);
      setEnding(false);
    }
  }

  function handleLeaveWithoutEnding() {
    const href = pendingHref;
    setPendingHref(null);
    if (href) router.push(href);
  }

  return (
    <div ref={containerRef}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-accent)",
          background: "var(--bg-accent)",
          padding: "4px 10px",
          borderRadius: 6,
          fontVariantNumeric: "tabular-nums",
        }}
        title="Time with this patient — this visit is in progress"
      >
        {formatDuration(total)}
      </span>

      {pendingHref && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div style={{ background: "var(--surface-0)", borderRadius: 12, padding: 20, maxWidth: 340, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
            <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 6px" }}>End this appointment before leaving?</p>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 16px" }}>
              The timer has been running for {formatDuration(total)}. If you're not done, choose "Not yet" — the
              timer keeps counting and you can end it later from here or from the dashboard queue.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setPendingHref(null)} style={dialogBtnStyle}>
                Cancel
              </button>
              <button onClick={handleLeaveWithoutEnding} style={dialogBtnStyle}>
                Not yet
              </button>
              <button onClick={handleEndAndLeave} disabled={ending} style={{ ...dialogBtnStyle, background: "var(--fill-accent)", color: "var(--on-accent)", border: "none" }}>
                {ending ? "Ending…" : "Yes, end visit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const dialogBtnStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "6px 12px",
  border: "0.5px solid var(--border-strong)",
  borderRadius: 6,
  background: "var(--surface-0)",
  cursor: "pointer",
};
