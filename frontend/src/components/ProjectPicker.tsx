import { FileZip, FolderSimple, UploadSimple, X } from "@phosphor-icons/react";
import { type DropzoneInputProps, type DropzoneRootProps } from "react-dropzone";
import type { RefObject } from "react";

interface FolderInfo {
  name: string;
  fileCount: number;
}

interface ProjectPickerProps {
  file: File | null;
  folderInfo: FolderInfo | null;
  bundling: boolean;
  isDragActive: boolean;
  busy: boolean;
  getRootProps: <T extends DropzoneRootProps>(props?: T) => T;
  getInputProps: <T extends DropzoneInputProps>(props?: T) => T;
  folderInputRef: RefObject<HTMLInputElement>;
  onClear: () => void;
  onFolderPicked: (files: File[]) => void;
}

/** The "no project chosen yet" vs. "one is selected" half of the upload form --
 * isolated from UploadPanel so that component's own JSX stays a manageable size. */
export function ProjectPicker({
  file,
  folderInfo,
  bundling,
  isDragActive,
  busy,
  getRootProps,
  getInputProps,
  folderInputRef,
  onClear,
  onFolderPicked,
}: ProjectPickerProps) {
  if (file) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
        <span className="flex min-w-0 items-center gap-3 text-sm text-slate-800">
          {folderInfo ? (
            <FolderSimple size={20} className="shrink-0 text-accent" />
          ) : (
            <FileZip size={20} className="shrink-0 text-accent" />
          )}
          <span className="truncate">{folderInfo ? folderInfo.name : file.name}</span>
          <span className="shrink-0 text-xs text-slate-400">
            {folderInfo ? `${folderInfo.fileCount} files` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}
          </span>
        </span>
        <button onClick={onClear} disabled={busy} className="shrink-0 text-slate-400 hover:text-rose-500" aria-label="Remove">
          <X size={18} />
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        {...getRootProps()}
        className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center transition ${
          isDragActive
            ? "border-accent bg-accent/10"
            : "border-line bg-slate-50/60 hover:border-accent/50 hover:bg-accent/5"
        }`}
      >
        <input {...getInputProps()} />
        <UploadSimple
          size={24}
          className={`mb-2 transition ${isDragActive ? "text-accent" : "text-slate-400 group-hover:text-accent"}`}
        />
        <p className="text-sm font-medium text-slate-700">
          {bundling ? "Reading folder…" : isDragActive ? "Drop it here" : "Drag & drop a project folder or .zip"}
        </p>
        <p className="mt-1 text-xs text-slate-400">or click to browse · max 50 MB</p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          folderInputRef.current?.click();
        }}
        className="mx-auto mt-3 block text-xs text-slate-400 underline-offset-2 transition hover:text-accent hover:underline"
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
          if (picked.length > 0) onFolderPicked(picked);
        }}
      />
    </>
  );
}
