import { ArrowLeft } from "@phosphor-icons/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../api/client";
import { AuthShell, Banner } from "../components/AuthShell";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send you a link to choose a new password."
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-accent">
          <ArrowLeft size={14} /> Back to sign in
        </Link>
      }
    >
      {error && <Banner kind="error">{error}</Banner>}
      {sent ? (
        <Banner kind="success">
          If an account exists for <span className="font-medium">{email}</span>, a reset link is on its
          way. Check your inbox (or the server console in development).
        </Banner>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-xs font-medium text-slate-600">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="field"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
