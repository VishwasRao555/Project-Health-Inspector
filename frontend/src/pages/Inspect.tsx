import { ArrowLeft } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { Dashboard } from "../components/Dashboard";
import { UploadPanel } from "../components/UploadPanel";
import type { HealthReport } from "../types/contract";

function scrollToSection(el: HTMLElement | null) {
  if (!el) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

export function Inspect() {
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
      <AppHeader onLogoClick={handleNewScan}>
        {report && (
          <button onClick={handleNewScan} className="btn-nav">
            <ArrowLeft size={14} /> New scan
          </button>
        )}
      </AppHeader>

      <main>
        <section
          ref={heroRef}
          className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl scroll-mt-16 items-center justify-center px-4 py-6 sm:px-6"
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
