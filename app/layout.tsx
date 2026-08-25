import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentPharmacist } from "@/lib/supabase/queries";

export const metadata: Metadata = {
  title: "Anticoagulation Management System",
  description: "Anticoagulation clinic management",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const currentPharmacist = await getCurrentPharmacist();

  return (
    <html lang="en">
      <body style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header
          style={{
            borderBottom: "0.5px solid var(--border)",
            padding: "10px 2rem",
            display: "flex",
            alignItems: "center",
            gap: 16,
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
            ACMS
          </Link>
          <Link
            href="/"
            style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}
          >
            &larr; Back to queue
          </Link>
        </header>

        <div style={{ flex: 1 }}>{children}</div>

        <footer
          style={{
            borderTop: "0.5px solid var(--border)",
            padding: "12px 2rem",
            fontSize: 11,
            color: "var(--text-muted)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {currentPharmacist && (
            <span>
              Logged in as {currentPharmacist.full_name} (User ID: {currentPharmacist.id})
            </span>
          )}
          <span>
            Developed by Shamin Mohd Saffian &middot; Any problems email{" "}
            <a href="mailto:shamin@ukm.edu.my" style={{ color: "var(--text-muted)" }}>
              shamin@ukm.edu.my
            </a>{" "}
            &middot; Version 1.0
          </span>
        </footer>
      </body>
    </html>
  );
}
