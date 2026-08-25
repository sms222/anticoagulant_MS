import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentPharmacist } from "@/lib/supabase/queries";
import { BackToQueueLink } from "@/components/layout/BackToQueueLink";

export const metadata: Metadata = {
  title: "UKM Anticoagulant Management System",
  description: "Anticoagulation clinic management",
};

const HEADER_HEIGHT = 52;
const FOOTER_HEIGHT = 54;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const currentPharmacist = await getCurrentPharmacist();

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <header
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: HEADER_HEIGHT,
            zIndex: 20,
            background: "var(--surface-0)",
            borderBottom: "0.5px solid var(--border)",
            padding: "0 2rem",
            display: "flex",
            alignItems: "center",
            gap: 16,
            boxSizing: "border-box",
          }}
        >
          <Link
            href="/"
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-accent)",
              textDecoration: "none",
              letterSpacing: 0.2,
            }}
          >
            UKM Anticoagulant Management System
          </Link>
          <BackToQueueLink />
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>
            {new Date().toLocaleString("en-MY", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </header>

        {/* This is the only scrollable region in the app — header and footer
            are pinned to the viewport so the footer never requires scrolling
            to see, no matter how tall a given page's content is. */}
        <div
          style={{
            marginTop: HEADER_HEIGHT,
            marginBottom: FOOTER_HEIGHT,
            minHeight: `calc(100vh - ${HEADER_HEIGHT + FOOTER_HEIGHT}px)`,
            overflowY: "auto",
          }}
        >
          {children}
        </div>

        <footer
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: FOOTER_HEIGHT,
            zIndex: 20,
            background: "var(--surface-0)",
            borderTop: "0.5px solid var(--border)",
            padding: "6px 2rem",
            fontSize: 11,
            color: "var(--text-muted)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 2,
            boxSizing: "border-box",
          }}
        >
          {currentPharmacist && (
            <span>
              Logged in as {currentPharmacist.full_name} (User ID: {currentPharmacist.id})
            </span>
          )}
          <span>
            &copy; {new Date().getFullYear()} Shamin Mohd Saffian. All rights reserved. &middot; Support:{" "}
            <a href="mailto:shamin@ukm.edu.my" style={{ color: "var(--text-muted)" }}>
              shamin@ukm.edu.my
            </a>{" "}
            &middot; v1.0
          </span>
        </footer>
      </body>
    </html>
  );
}
