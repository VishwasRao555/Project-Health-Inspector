import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { simpleGit } from "simple-git";
import type { RepoHandle, RepositorySource } from "./RepositorySource";

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
      await simpleGit().clone(`${url}.git`, rootDir, ["--depth", "1"]);
    } catch (err) {
      await fs.rm(rootDir, { recursive: true, force: true }).catch(() => {});
      throw new Error(
        `Failed to clone ${url}. Ensure the repository is public and the URL is correct.`
      );
    }

    return {
      rootDir,
      cleanup: () => fs.rm(rootDir, { recursive: true, force: true }).catch(() => {}),
    };
  }
}
