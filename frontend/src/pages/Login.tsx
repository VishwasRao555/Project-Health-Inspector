import { ArrowRight, Eye, EyeSlash } from "@phosphor-icons/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AuthShell, Banner } from "../components/AuthShell";

type Mode = "login" | "register";

export function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isRegister) await register(email, password);
      else await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={isRegister ? "Create your account" : "Inspect any codebase"}
      subtitle={
        isRegister
          ? "Sign up to analyze repositories and track project health over time."
          : "Sign in to scan GitHub repos and ZIP uploads for architecture, security, and quality issues."
      }
      footer={
        isRegister ? (
          <>
            Already have an account?{" "}
            <button onClick={() => setMode("login")} className="font-medium text-accent-cyan hover:underline">
              Sign in
            </button>
          </>
        ) : (
          <>
            New here?{" "}
            <button onClick={() => setMode("register")} className="font-medium text-accent-cyan hover:underline">
              Create an account
            </button>
          </>
        )
      }
    >
      {error && <Banner kind="error">{error}</Banner>}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="block text-xs font-medium text-gray-400">
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-xs font-medium text-gray-400">
              Password
            </label>
            {!isRegister && (
              <Link to="/forgot-password" className="text-xs text-gray-500 hover:text-accent-cyan">
                Forgot password?
              </Link>
            )}
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPw ? "text" : "password"}
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={8}
              className="field pr-11"
              placeholder={isRegister ? "At least 8 characters" : "••••••••"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {isRegister && (
            <p className="text-xs text-gray-500">Use 8+ characters with a mix of letters and numbers.</p>
          )}
        </div>

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Working…" : isRegister ? "Create account" : "Sign in"}
          {!busy && <ArrowRight size={16} weight="bold" />}
        </button>
      </form>
    </AuthShell>
  );
}
