import { ArrowLeft, SignOut } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Brand } from "../components/brand";
import { Dashboard } from "../components/Dashboard";
import { UploadPanel } from "../components/UploadPanel";
import type { HealthReport } from "../types/contract";

function scrollToSection(el: HTMLElement | null) {
  if (!el) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

export function Inspect() {
  const { user, logout } = useAuth();
  const [report, setReport] = useState<HealthReport | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  function handleReport(r: HealthReport) {
    setReport(r);
    // The results section only mounts once `report` is set — wait a frame so it
    // exists in the DOM before we scroll to it.
    requestAnimationFrame(() => {
      scrollToSection(resultsRef.current);
      resultsRef.current?.focus();
    });
  }

  function handleNewScan() {
    setReport(null);
    scrollToSection(heroRef.current);
  }

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 border-b border-line/0 bg-transparent">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button onClick={handleNewScan} className="transition hover:opacity-80" aria-label="Home">
            <Brand />
          </button>
          <div className="flex items-center gap-3">
            {report && (
              <button onClick={handleNewScan} className="btn-ghost !px-4 !py-2 text-xs">
                <ArrowLeft size={14} /> New scan
              </button>
            )}
            <span className="hidden text-xs text-gray-500 sm:inline">{user?.email}</span>
            <button
              onClick={logout}
              className="grid h-9 w-9 place-items-center rounded-lg border border-line text-gray-400 transition hover:border-rose-500/40 hover:text-rose-300"
              aria-label="Sign out"
              title="Sign out"
            >
              <SignOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section
          ref={heroRef}
          className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl scroll-mt-16 items-center justify-center px-4 py-10 sm:px-6"
        >
          <UploadPanel onReport={handleReport} />
        </section>

        {report && (
          <section
            ref={resultsRef}
            tabIndex={-1}
            aria-label="Analysis results"
            className="mx-auto max-w-6xl scroll-mt-16 px-4 py-14 outline-none sm:px-6 animate-fade-up"
          >
            <span className="sr-only" role="status">
              Analysis complete — results below.
            </span>
            <Dashboard report={report} />
          </section>
        )}
      </main>
    </div>
  );
}
