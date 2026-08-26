"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Enter your email.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    // Always show the same "sent" state regardless of whether the email exists —
    // don't let this screen be used to check which emails have accounts.
    if (resetError) {
      setError("Something went wrong sending that. Try again in a moment.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <main style={{ maxWidth: 360, margin: "10vh auto", padding: "0 1.5rem" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 8 }}>Check your email</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          If an account exists for {email}, we&apos;ve sent a password reset link. Click it to set a new
          password.
        </p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 16 }}>
          <a href="/login">Back to sign in</a>
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 360, margin: "10vh auto", padding: "0 1.5rem" }}>
      <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 4 }}>Reset password</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
        Enter your email and we&apos;ll send you a link to set a new password.
      </p>
      <form onSubmit={handleSubmit}>
        <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@hospital.my"
          style={{ width: "100%", marginBottom: 12, height: 36 }}
        />
        {error && <p style={{ fontSize: 13, color: "var(--text-danger)", margin: "0 0 12px" }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
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
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 16 }}>
        <a href="/login">Back to sign in</a>
      </p>
    </main>
  );
}
