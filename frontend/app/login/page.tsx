"use client";
// app/login/page.tsx

import Link from "next/link";
import { useState } from "react";
import PasswordInput from "@/components/ui/PasswordInput";
import Icon from "@/components/Icon";
import { useAuth } from "@/lib/auth/AuthContext";

export default function LoginPage() {
  const { login, error } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(username, password);
    } catch {
      // error surfaces via context
    } finally {
      setSubmitting(false);
    }
  };

  // One-click demo: fill the fields (so the visitor sees the credentials) and
  // sign straight in with the seeded demo account.
  const tryDemo = async () => {
    setUsername("demo");
    setPassword("demo");
    setSubmitting(true);
    try {
      await login("demo", "demo");
    } catch {
      // error surfaces via context
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">$</div>
          <div className="brand-name">Split<em>Easy</em></div>
        </div>
        <h1>Welcome back</h1>
        <p className="auth-sub">Sign in to split expenses and settle up with your groups.</p>

        {error && (
          <div className="auth-error" role="alert">
            <Icon name="info" size={14} /> {error}
          </div>
        )}

        <form onSubmit={submit} className="auth-form">
          <label>
            <span>Username</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <PasswordInput
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Demo account hint — lets reviewers explore instantly */}
        <details className="auth-demo"><summary>Just exploring? Try the demo</summary>
          <div className="auth-demo-head">
            <Icon name="info" size={14} />
            <span>Just exploring? Use the demo account</span>
          </div>
          <div className="auth-demo-creds">
            <span>Username <code>demo</code></span>
            <span>Password <code>demo</code></span>
          </div>
          <button
            type="button"
            className="btn btn-secondary auth-demo-btn"
            onClick={tryDemo}
            disabled={submitting}
          >
            <Icon name="settle" size={14} /> Try the demo
          </button>
        </details>

        <div className="auth-foot">
          New here? <Link href="/signup">Create an account</Link>
        </div>
      </div>
    </div>
  );
}
