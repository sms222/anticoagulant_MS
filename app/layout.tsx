import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Anticoagulation Management System",
  description: "Anticoagulation clinic management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
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
        {children}
      </body>
    </html>
  );
}
