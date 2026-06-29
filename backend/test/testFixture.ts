import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach } from "vitest";

const tmpDirs: string[] = [];

/** Writes `files` (relPath -> content) under a fresh temp dir and returns its root. */
export async function makeFixture(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "phi-analyzer-test-"));
  tmpDirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, "utf8");
  }
  return dir;
}

/** Call once per test file to clean up every fixture dir it created. */
export function registerFixtureCleanup(): void {
  afterEach(async () => {
    while (tmpDirs.length) {
      const dir = tmpDirs.pop()!;
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
}
