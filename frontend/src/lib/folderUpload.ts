import JSZip from "jszip";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

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

/** Yields to the browser for one paint so a just-flipped loading state is visible before heavy work starts. */
export function paintNow(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/** Bundles a flat list of dropped/selected folder files into a single in-browser zip. */
export async function zipFolder(
  files: File[]
): Promise<{ zipFile: File; folderName: string; fileCount: number }> {
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
