import { GithubLogo, Rocket, Sparkle } from "@phosphor-icons/react";
import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ApiError, api } from "../api/client";
import { MAX_UPLOAD_BYTES, paintNow, zipFolder } from "../lib/folderUpload";
import type { HealthReport } from "../types/contract";
import { LoadingBoxes } from "./LoadingBoxes";
import { ProjectPicker } from "./ProjectPicker";
import { ToolMarquee } from "./ToolMarquee";

interface UploadPanelProps {
  onReport: (report: HealthReport) => void;
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
      if (incoming[0].size > MAX_UPLOAD_BYTES) {
        setError("That .zip is over the 50 MB limit.");
        return;
      }
      setFile(incoming[0]);
      setFolderInfo(null);
      setRepoUrl("");
      return;
    }

    setBundling(true);
    await paintNow();
    try {
      const { zipFile, folderName, fileCount } = await zipFolder(incoming);
      if (fileCount === 0) {
        setError("That folder has no files we can analyze.");
        return;
      }
      if (zipFile.size > MAX_UPLOAD_BYTES) {
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
    await paintNow();
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
      <div className="mb-4 flex flex-col items-center text-center animate-fade-up">
        
        <h1 className="font-display text-4xl uppercase leading-[0.95] tracking-tight text-slate-900 sm:text-5xl">
          YOUR CODE DESERVES
          <span className="block text-accent">A SECOND OPINION.</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
          Point us at a GitHub repository, or drop a project folder straight from your
          machine. Ten analyzers comb through architecture, security, and quality —
          right down to typos — and score it without mercy.
        </p>
      </div>

      <div className="console-card animate-fade-up p-4 sm:p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Inspect your project directly
        </p>

        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
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

        <div className="my-3 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-line" />
          OR
          <span className="h-px flex-1 bg-line" />
        </div>

        <ProjectPicker
          file={file}
          folderInfo={folderInfo}
          bundling={bundling}
          isDragActive={isDragActive}
          busy={busy}
          getRootProps={getRootProps}
          getInputProps={getInputProps}
          folderInputRef={folderInputRef}
          onClear={clearFile}
          onFolderPicked={acceptFiles}
        />

        <button onClick={runAnalysis} disabled={!canRun} className="btn-primary mt-4 w-full">
          {bundling ? "Reading folder…" : busy ? "Analyzing…" : "Launch inspection"}
          {busy || bundling ? <LoadingBoxes /> : <Rocket size={16} weight="fill" />}
        </button>
      </div>

      <ToolMarquee />

      <p className="mt-4 text-center text-xs text-slate-400">
        Public GitHub repos are cloned shallowly and local uploads are deleted right
        after analysis.
      </p>
    </div>
  );
}
