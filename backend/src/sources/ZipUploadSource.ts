import AdmZip from "adm-zip";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { RepoHandle, RepositorySource } from "./RepositorySource";

/** Materializes an uploaded ZIP buffer by extracting it into an OS temp dir. */
export class ZipUploadSource implements RepositorySource {
  constructor(private readonly buffer: Buffer) {}

  async materialize(): Promise<RepoHandle> {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "phi-zip-"));
    try {
      const zip = new AdmZip(this.buffer);
      // extractAllTo is synchronous; guard against zip-slip by validating entry paths.
      for (const entry of zip.getEntries()) {
        const target = path.join(rootDir, entry.entryName);
        const resolved = path.resolve(target);
        if (!resolved.startsWith(path.resolve(rootDir))) {
          throw new Error(`Unsafe path in zip: ${entry.entryName}`);
        }
      }
      zip.extractAllTo(rootDir, true);
    } catch (err) {
      await fs.rm(rootDir, { recursive: true, force: true }).catch(() => {});
      throw new Error(
        `Failed to extract uploaded zip: ${err instanceof Error ? err.message : "unknown error"}`
      );
    }

    // If the zip wrapped everything in a single top-level folder, descend into it
    // so analyzers see the project root, not a wrapper directory.
    const root = await collapseSingleRoot(rootDir);
    return {
      rootDir: root,
      cleanup: () => fs.rm(rootDir, { recursive: true, force: true }).catch(() => {}),
    };
  }
}

async function collapseSingleRoot(dir: string): Promise<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const visible = entries.filter((e) => !e.name.startsWith("__MACOSX"));
  if (visible.length === 1 && visible[0].isDirectory()) {
    return path.join(dir, visible[0].name);
  }
  return dir;
}
