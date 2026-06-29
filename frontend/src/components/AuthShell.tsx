import type { ReactNode } from "react";
import { Brand } from "./brand";

interface AuthShellProps {
  title: ReactNode;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Centered glowing-console layout shared by all auth screens (the hero moment). */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 animate-fade-up">
        <Brand />
      </div>

      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-7 text-center">
          <h1 className="font-display text-4xl uppercase leading-[0.95] tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
            {subtitle}
          </p>
        </div>

        <div className="console-card p-6 sm:p-7">{children}</div>

        {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
      </div>
    </main>
  );
}

/** Inline error / success banner used across auth forms. */
export function Banner({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  const styles =
    kind === "error"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-700"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${styles}`}
    >
      {children}
    </div>
  );
}
