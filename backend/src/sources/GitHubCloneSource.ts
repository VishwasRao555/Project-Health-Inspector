import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { simpleGit } from "simple-git";
import type { RepoHandle, RepositorySource } from "./RepositorySource";

// `--depth 1` bounds history, not working-tree size, and a slow/stalled remote can hang
// the clone indefinitely -- both are real DoS surfaces since this accepts arbitrary
// public URLs from any authenticated user.
const CLONE_TIMEOUT_MS = 60_000;
export const MAX_CLONE_BYTES = 500 * 1024 * 1024; // 500 MB, matches the zip upload cap

/** Sums file sizes under `dir`. Pure/exported so the cap can be unit-tested directly. */
export async function dirSize(dir: string): Promise<number> {
  let total = 0;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await dirSize(full);
    else if (entry.isFile()) total += (await fs.stat(full)).size;
  }
  return total;
}

/** Materializes a GitHub repo via a shallow clone into an OS temp dir. */
export class GitHubCloneSource implements RepositorySource {
  constructor(private readonly url: string) {}

  static isValidUrl(url: string): boolean {
    return /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(url.trim());
  }

  async materialize(): Promise<RepoHandle> {
    const url = this.url.trim().replace(/\.git$/, "").replace(/\/$/, "");
    if (!GitHubCloneSource.isValidUrl(url)) {
      throw new Error(`Invalid GitHub URL: ${this.url}`);
    }

    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "phi-clone-"));
    try {
      // `timeout.block` kills the spawned git process itself after this many ms of
      // silence, rather than just abandoning a promise while git keeps running.
      const git = simpleGit({ timeout: { block: CLONE_TIMEOUT_MS } });
      await git.clone(`${url}.git`, rootDir, ["--depth", "1"]);

      const size = await dirSize(rootDir);
      if (size > MAX_CLONE_BYTES) {
        throw new Error(
          `Repository is ${(size / 1024 / 1024).toFixed(0)} MB, over the ${(MAX_CLONE_BYTES / 1024 / 1024).toFixed(0)} MB limit.`
        );
      }
    } catch (err) {
      await fs.rm(rootDir, { recursive: true, force: true }).catch(() => {});
      const message = err instanceof Error && /MB limit/.test(err.message) ? err.message : null;
      throw new Error(
        message ?? `Failed to clone ${url}. Ensure the repository is public and the URL is correct.`
      );
    }

    return {
      rootDir,
      cleanup: () => fs.rm(rootDir, { recursive: true, force: true }).catch(() => {}),
    };
  }
}
