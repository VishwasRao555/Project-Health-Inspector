import { Pulse } from "@phosphor-icons/react";
import type { Severity } from "../types/contract";

/** Wordmark + glyph used in nav and auth headers. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
        <Pulse size={18} weight="bold" />
      </span>
      {!compact && (
        <span className="font-display text-[19px] uppercase leading-none tracking-tight text-slate-900">
          Health Inspector
        </span>
      )}
    </div>
  );
}

/** Maps a 0-100 score to a Tailwind text color (tuned for light surfaces). */
export function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-accent";
  if (score >= 40) return "text-amber-500";
  return "text-rose-500";
}

export function scoreHex(score: number): string {
  if (score >= 80) return "#059669";
  if (score >= 60) return "#2563eb";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

export const SEVERITY_META: Record<
  Severity,
  { label: string; text: string; bg: string; dot: string }
> = {
  critical: { label: "Critical", text: "text-rose-600", bg: "bg-rose-500/10 border-rose-500/25", dot: "bg-rose-500" },
  high: { label: "High", text: "text-orange-600", bg: "bg-orange-500/10 border-orange-500/25", dot: "bg-orange-500" },
  medium: { label: "Medium", text: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/25", dot: "bg-amber-500" },
  low: { label: "Low", text: "text-sky-600", bg: "bg-sky-500/10 border-sky-500/25", dot: "bg-sky-500" },
};
