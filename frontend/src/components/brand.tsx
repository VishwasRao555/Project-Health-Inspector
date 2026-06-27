import { Pulse } from "@phosphor-icons/react";
import type { Severity } from "../types/contract";

/** Wordmark + glyph used in nav and auth headers. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan">
        <Pulse size={18} weight="bold" />
      </span>
      {!compact && (
        <span className="font-display text-[15px] font-semibold tracking-tight text-white">
          Health Inspector
        </span>
      )}
    </div>
  );
}

/** Maps a 0-100 score to a Tailwind text color. */
export function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-accent-cyan";
  if (score >= 40) return "text-amber-400";
  return "text-rose-400";
}

export function scoreHex(score: number): string {
  if (score >= 80) return "#34d399";
  if (score >= 60) return "#38bdf8";
  if (score >= 40) return "#fbbf24";
  return "#fb7185";
}

export const SEVERITY_META: Record<
  Severity,
  { label: string; text: string; bg: string; dot: string }
> = {
  critical: { label: "Critical", text: "text-rose-300", bg: "bg-rose-500/10 border-rose-500/30", dot: "bg-rose-400" },
  high: { label: "High", text: "text-orange-300", bg: "bg-orange-500/10 border-orange-500/30", dot: "bg-orange-400" },
  medium: { label: "Medium", text: "text-amber-300", bg: "bg-amber-500/10 border-amber-500/30", dot: "bg-amber-400" },
  low: { label: "Low", text: "text-sky-300", bg: "bg-sky-500/10 border-sky-500/30", dot: "bg-sky-400" },
};
