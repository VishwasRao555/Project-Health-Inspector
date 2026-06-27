import { FileZip, FolderSimple, GithubLogo, Rocket, Sparkle, UploadSimple, X } from "@phosphor-icons/react";
import JSZip from "jszip";
import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ApiError, api } from "../api/client";
import type { HealthReport } from "../types/contract";
import { LoadingBoxes } from "./LoadingBoxes";
import { ToolMarquee } from "./ToolMarquee";

interface UploadPanelProps {
  onReport: (report: HealthReport) => void;
}

const MAX_BYTES = 50 * 1024 * 1024;

// Mirrors the backend's buildContext.ts ignore list so a dropped folder doesn't drag
// node_modules/.git along for the ride before it ever reaches the server.
const IGNORED_DIR_SEGMENTS = new Set([
  "node_modules", ".git", "dist", "build", "out", "coverage", ".next", ".turbo", ".cache", "vendor",
]);

/** Drag-and-drop (file-selector) and <input webkitdirectory> both stash the relative path differently. */
function relativePathOf(file: File): string {
  const f = file as File & { relativePath?: string; path?: string };
  return (f.relativePath || f.path || file.webkitRelativePath || file.name).replace(/^\.?\//, "");
}

function isInsideIgnoredDir(rel: string): boolean {
  return rel.split("/").slice(0, -1).some((seg) => IGNORED_DIR_SEGMENTS.has(seg));
}

/** Bundles a flat list of dropped/selected folder files into a single in-browser zip. */
async function zipFolder(files: File[]): Promise<{ zipFile: File; folderName: string; fileCount: number }> {
  const zip = new JSZip();
  let folderName = "project";
  let fileCount = 0;
  for (const file of files) {
    const rel = relativePathOf(file);
    if (!rel || isInsideIgnoredDir(rel)) continue;
    const top = rel.split("/")[0];
    if (top) folderName = top;
    zip.file(rel, file);
    fileCount++;
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return { zipFile: new File([blob], `${folderName}.zip`, { type: "application/zip" }), folderName, fileCount };
}

/**
 * The glowing console card: GitHub URL field + drag-and-drop zone (ZIP or a whole
 * project folder, zipped client-side), both feeding POST /api/analyze. Mirrors the
 * Expo-launch "launch from GitHub" panel's structure and type, with our own content.
 */
export function UploadPanel({ onReport }: UploadPanelProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [folderInfo, setFolderInfo] = useState<{ name: string; fileCount: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [bundling, setBundling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const acceptFiles = useCallback(async (incoming: File[]) => {
    setError(null);
    if (incoming.length === 0) return;

    const singleZip = incoming.length === 1 && /\.zip$/i.test(incoming[0].name);
    if (singleZip) {
      if (incoming[0].size > MAX_BYTES) {
        setError("That .zip is over the 50 MB limit.");
        return;
      }
      setFile(incoming[0]);
      setFolderInfo(null);
      setRepoUrl("");
      return;
    }

    setBundling(true);
    try {
      const { zipFile, folderName, fileCount } = await zipFolder(incoming);
      if (fileCount === 0) {
        setError("That folder has no files we can analyze.");
        return;
      }
      if (zipFile.size > MAX_BYTES) {
        setError("That folder is over the 50 MB limit once compressed.");
        return;
      }
      setFile(zipFile);
      setFolderInfo({ name: folderName, fileCount });
      setRepoUrl("");
    } catch {
      setError("Couldn't read that folder. Please try again.");
    } finally {
      setBundling(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: acceptFiles,
    multiple: true,
    noClick: false,
  });

  function clearFile() {
    setFile(null);
    setFolderInfo(null);
  }

  async function runAnalysis() {
    setError(null);
    setBusy(true);
    try {
      const report = file ? await api.analyzeZip(file) : await api.analyzeUrl(repoUrl.trim());
      onReport(report);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Analysis failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const canRun = !busy && !bundling && (file !== null || repoUrl.trim().length > 0);

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-7 flex flex-col items-center text-center animate-fade-up">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-ink-900/70 px-3.5 py-1.5 text-xs text-gray-400">
          <Sparkle size={13} weight="fill" className="text-accent-cyan" />
          Now reading folders, not just zips
        </span>
        <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl">
          Ship code you
          <span className="block text-gray-500">can stand behind.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-gray-400">
          Point us at a GitHub repository, or drop a project folder straight from your
          machine. Ten analyzers comb through architecture, security, and quality —
          right down to typos — and score it without mercy.
        </p>
      </div>

      <div className="console-card animate-fade-up p-5 sm:p-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">
          Inspect your project directly
        </p>

        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {/* GitHub URL */}
        <div className="relative">
          <GithubLogo size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="url"
            className="field pl-11"
            placeholder="https://github.com/user/project"
            value={repoUrl}
            disabled={busy || file !== null}
            onChange={(e) => {
              setRepoUrl(e.target.value);
              setError(null);
            }}
          />
        </div>

        <div className="my-4 flex items-center gap-3 text-xs text-gray-600">
          <span className="h-px flex-1 bg-line" />
          OR
          <span className="h-px flex-1 bg-line" />
        </div>

        {/* Drag-and-drop a .zip or a whole folder */}
        {file ? (
          <div className="flex items-center justify-between rounded-xl border border-accent-cyan/40 bg-accent-cyan/5 px-4 py-3">
            <span className="flex min-w-0 items-center gap-3 text-sm text-gray-200">
              {folderInfo ? (
                <FolderSimple size={20} className="shrink-0 text-accent-cyan" />
              ) : (
                <FileZip size={20} className="shrink-0 text-accent-cyan" />
              )}
              <span className="truncate">{folderInfo ? folderInfo.name : file.name}</span>
              <span className="shrink-0 text-xs text-gray-500">
                {folderInfo ? `${folderInfo.fileCount} files` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}
              </span>
            </span>
            <button
              onClick={clearFile}
              disabled={busy}
              className="shrink-0 text-gray-500 hover:text-rose-300"
              aria-label="Remove"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <>
            <div
              {...getRootProps()}
              className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-7 text-center transition ${
                isDragActive
                  ? "border-accent-cyan bg-accent-cyan/10"
                  : "border-line bg-ink-900/60 hover:border-accent-cyan/50 hover:bg-ink-800/60"
              }`}
            >
              <input {...getInputProps()} />
              <UploadSimple
                size={26}
                className={`mb-2 transition ${isDragActive ? "text-accent-cyan" : "text-gray-500 group-hover:text-accent-cyan"}`}
              />
              <p className="text-sm font-medium text-gray-300">
                {bundling ? "Reading folder…" : isDragActive ? "Drop it here" : "Drag & drop a project folder or .zip"}
              </p>
              <p className="mt-1 text-xs text-gray-500">or click to browse · max 50 MB</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                folderInputRef.current?.click();
              }}
              className="mx-auto mt-3 block text-xs text-gray-500 underline-offset-2 transition hover:text-accent-cyan hover:underline"
            >
              or choose a folder from your computer
            </button>
            <input
              ref={folderInputRef}
              type="file"
              multiple
              className="hidden"
              {...({ webkitdirectory: "true", directory: "" } as Record<string, string>)}
              onChange={async (e) => {
                const picked = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (picked.length > 0) await acceptFiles(picked);
              }}
            />
          </>
        )}

        <button onClick={runAnalysis} disabled={!canRun} className="btn-primary mt-5 w-full">
          {bundling ? "Reading folder…" : busy ? "Analyzing…" : "Launch inspection"}
          {busy || bundling ? <LoadingBoxes /> : <Rocket size={16} weight="fill" />}
        </button>
      </div>

      <ToolMarquee />

      <p className="mt-6 text-center text-xs text-gray-600">
        Public GitHub repos are cloned shallowly and local uploads are deleted right
        after analysis.
      </p>
    </div>
  );
}
