"use client";
// app/signup/page.tsx

import Link from "next/link";
import { useState } from "react";
import Icon from "@/components/Icon";
import { useAuth } from "@/lib/auth/AuthContext";

export default function SignupPage() {
  const { register, error } = useAuth();
  const [form, setForm] = useState({ username: "", email: "", password: "", full_name: "" });
  const [submitting, setSubmitting] = useState(false);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await register(form);
    } catch {
      /* error surfaces via context */
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
        <h1>Create your account</h1>
        <p className="auth-sub">Free to use. No card required.</p>

        {error && (
          <div className="auth-error">
            <Icon name="info" size={14} /> {error}
          </div>
        )}

        <form onSubmit={submit} className="auth-form">
          <label>
            <span>Full name</span>
            <input type="text" value={form.full_name} onChange={update("full_name")} />
          </label>
          <label>
            <span>Username</span>
            <input type="text" value={form.username} onChange={update("username")} required />
          </label>
          <label>
            <span>Email</span>
            <input type="email" value={form.email} onChange={update("email")} required />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={update("password")}
              required
              minLength={6}
            />
          </label>
          <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="auth-foot">
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
