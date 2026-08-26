"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  // The reset-password email link lands here carrying either a `?code=...`
  // (PKCE flow) or a `#access_token=...&type=recovery` hash (implicit flow),
  // depending on how the Supabase project is configured. Handle both rather
  // than assuming one.
  useEffect(() => {
    const supabase = createClient();

    async function establishSession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setLinkInvalid(true);
          setReady(true);
          return;
        }
        setReady(true);
        return;
      }
      // Implicit flow: supabase-js auto-detects the #access_token in the URL
      // on client init (detectSessionInUrl defaults to true) and fires this
      // event once it's parsed the hash into a session.
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          setReady(true);
        }
      });
      // If a session already exists by the time we check (e.g. hash already
      // processed before this effect ran), don't leave the user stuck.
      const { data } = await supabase.auth.getSession();
      if (data.session) setReady(true);
      // Give it a moment; if nothing showed up, the link was likely invalid/expired.
      const timeout = setTimeout(() => {
        setReady((r) => {
          if (!r) setLinkInvalid(true);
          return true;
        });
      }, 4000);
      return () => {
        subscription.unsubscribe();
        clearTimeout(timeout);
      };
    }

    establishSession();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password needs to be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/login");
    }, 1800);
  }

  if (!ready) {
    return (
      <main style={{ maxWidth: 360, margin: "10vh auto", padding: "0 1.5rem" }}>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Checking your reset link&hellip;</p>
      </main>
    );
  }

  if (linkInvalid) {
    return (
      <main style={{ maxWidth: 360, margin: "10vh auto", padding: "0 1.5rem" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 8 }}>Link expired or invalid</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
          Reset links only work once and expire after a while. Request a new one.
        </p>
        <a href="/forgot-password" style={{ fontSize: 13 }}>
          Send a new reset link
        </a>
      </main>
    );
  }

  if (done) {
    return (
      <main style={{ maxWidth: 360, margin: "10vh auto", padding: "0 1.5rem" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 8 }}>Password updated</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Taking you to sign in&hellip;</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 360, margin: "10vh auto", padding: "0 1.5rem" }}>
      <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 4 }}>Set a new password</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
        Choose a new password for your account.
      </p>
      <form onSubmit={handleSubmit}>
        <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
          New password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
    </main>
  );
}
