import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { exists as nodeExists, mkdir as nodeMkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { isErr, isOk } from "ripthrow";
import { loadManifest, saveManifest } from "./manifest";

describe("manifest core io", () => {
  const testDir = join(process.cwd(), "temp-test-manifest");
  const originalCwd = process.cwd();

  beforeAll(async () => {
    if (await nodeExists(testDir)) {
      await rm(testDir, { recursive: true });
    }
    await nodeMkdir(testDir);
    process.chdir(testDir);
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    if (await nodeExists(testDir)) {
      await rm(testDir, { recursive: true });
    }
  });

  it("should save and load a manifest", async () => {
    const config = {
      version: 1 as const,
      lang: "rust" as const,
      platform: "github" as const,
      artifacts: [{ type: "bin" as const, name: "app", outputName: "{name}" }],
      targets: [
        {
          id: "linux",
          for: "app",
          type: "bin" as const,
          os: "linux" as const,
          arch: ["x86_64" as const],
          packages: ["tar.gz" as const],
        },
      ],
    };

    const saveResult = await saveManifest(config);
    expect(isOk(saveResult)).toBe(true);

    const loadResult = await loadManifest();
    expect(isOk(loadResult)).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.value.lang).toBe("rust");
      expect(loadResult.value.artifacts).toHaveLength(1);
    }
  });

  it("should return error if manifest does not exist", async () => {
    // Ensure a clean state by removing any manifest created by previous tests.
    try {
      await rm("refinery.toml");
    } catch {
      // Ignore if the file does not exist.
    }

    const loadResult = await loadManifest();
    expect(isErr(loadResult)).toBe(true);
  });
});
