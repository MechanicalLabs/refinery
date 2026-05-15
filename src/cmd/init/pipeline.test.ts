import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { exists as nodeExists, mkdir as nodeMkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { isOk } from "ripthrow";
import { executeInitPipeline } from "./pipeline";
import type { ProjectAnswers } from "./ui";

describe("init pipeline", () => {
  const testDir = join(process.cwd(), "temp-test-pipeline");
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

  it("should successfully execute the init pipeline for rust/github", async () => {
    const answers: ProjectAnswers = {
      language: "rust",
      platform: "github",
      artifacts: [{ type: "bin", name: "app", outputName: "{name}" }],
      targets: [
        {
          id: "linux",
          for: "app",
          type: "bin",
          os: "linux",
          arch: ["x86_64"],
          packages: ["tar.gz"],
        },
      ],
    };

    const result = await executeInitPipeline(answers);
    expect(isOk(result)).toBe(true);

    // Verify refinery.toml was created
    const tomlExists = await nodeExists("refinery.toml");
    expect(tomlExists).toBe(true);
  });
});
