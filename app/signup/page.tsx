"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setError("Fill in your name, email, and password.");
      return;
    }
    if (password.length < 8) {
      setError("Password needs to be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      router.push("/");
      router.refresh();
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <main style={{ maxWidth: 360, margin: "10vh auto", padding: "0 1.5rem" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 8 }}>Check your email</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          We sent a confirmation link to {email}. Click it, then come back and sign in.
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 360, margin: "10vh auto", padding: "0 1.5rem" }}>
      <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 4 }}>Create account</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
        ACMS — for clinic staff only
      </p>
      <form onSubmit={handleSubmit}>
        <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
          Full name
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Dr. Lim Wei Jian"
          style={{ width: "100%", marginBottom: 12, height: 36 }}
        />
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
        <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", marginBottom: 8, height: 36 }}
        />
        {error && (
          <p style={{ fontSize: 13, color: "var(--text-danger)", margin: "0 0 12px" }}>{error}</p>
        )}
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
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 16 }}>
        Already have an account? <a href="/login">Sign in</a>
      </p>
    </main>
  );
}
