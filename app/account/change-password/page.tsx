"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("New password needs to be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();

    // Re-check the current password before allowing a change — updateUser()
    // alone would let anyone with an already-open session change the
    // password without proving they know the current one.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      setLoading(false);
      setError("Could not verify your session. Try signing in again.");
      return;
    }
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) {
      setLoading(false);
      setError("Current password is incorrect.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 360, margin: "0 auto" }}>
      <Link href="/" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>
        &larr; Back to dashboard
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 500, margin: "8px 0 20px" }}>Change password</h1>

      {done ? (
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Password updated. It&apos;ll be needed next time you sign in.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
            Current password
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            style={{ width: "100%", marginBottom: 12, height: 36 }}
          />
          <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
            New password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ width: "100%", marginBottom: 12, height: 36 }}
          />
          <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
            Confirm new password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={{ width: "100%", marginBottom: 8, height: 36 }}
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
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
      )}
    </main>
  );
}
