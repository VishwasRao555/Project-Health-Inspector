import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { dirSize } from "../src/sources/GitHubCloneSource";
import { assertWithinDecompressedLimit } from "../src/sources/ZipUploadSource";

describe("assertWithinDecompressedLimit", () => {
  it("rejects when total entry size exceeds the cap", () => {
    expect(() => assertWithinDecompressedLimit([40, 40, 40], 100)).toThrow(/decompressed limit/);
  });

  it("allows entries at or under the cap", () => {
    expect(() => assertWithinDecompressedLimit([40, 40, 20], 100)).not.toThrow();
  });
});

describe("dirSize", () => {
  const tmpDirs: string[] = [];

  afterEach(async () => {
    while (tmpDirs.length) {
      const dir = tmpDirs.pop()!;
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("sums file sizes recursively across nested directories", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "phi-dirsize-test-"));
    tmpDirs.push(dir);
    await fs.writeFile(path.join(dir, "a.txt"), "x".repeat(10));
    await fs.mkdir(path.join(dir, "nested"));
    await fs.writeFile(path.join(dir, "nested", "b.txt"), "y".repeat(25));

    await expect(dirSize(dir)).resolves.toBe(35);
  });
});
