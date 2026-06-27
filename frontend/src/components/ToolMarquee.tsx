import {
  Atom,
  Broom,
  CodeBlock,
  FileCode,
  LockKey,
  Notebook,
  Package,
  ShieldCheck,
  Stack,
  TreeStructure,
  type Icon,
} from "@phosphor-icons/react";

interface Tool {
  name: string;
  icon: Icon;
}

/** The ten analyzers the Inspector runs in parallel — see backend/src/analyzers/registry.ts. */
const TOOLS: Tool[] = [
  { name: "Architecture Mapper", icon: TreeStructure },
  { name: "Project Structure Auditor", icon: Stack },
  { name: "Code Quality Inspector", icon: CodeBlock },
  { name: "Dead Code Sweeper", icon: Broom },
  { name: "Type Safety Checker", icon: FileCode },
  { name: "React Pattern Auditor", icon: Atom },
  { name: "Security Scanner", icon: ShieldCheck },
  { name: "Environment Validator", icon: LockKey },
  { name: "Dependency Auditor", icon: Package },
  { name: "Documentation Reviewer", icon: Notebook },
];

/** Duplicated once so the CSS marquee can loop seamlessly at -50%. */
const TRACK = [...TOOLS, ...TOOLS];

/** Horizontally scrolling strip of the analyzers running under the hood. */
export function ToolMarquee() {
  return (
    <div className="mt-10 animate-fade-up">
      <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-wider text-gray-600">
        10 analyzers inspecting your project
      </p>
      <div className="marquee-mask relative overflow-hidden">
        <div className="marquee-track flex w-max items-center gap-3">
          {TRACK.map((tool, i) => (
            <span
              key={`${tool.name}-${i}`}
              className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-ink-900/60 px-4 py-2 text-xs text-gray-400"
            >
              <tool.icon size={14} weight="bold" />
              {tool.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
