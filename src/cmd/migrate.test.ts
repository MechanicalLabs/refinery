import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
  exists as nodeExists,
  mkdir as nodeMkdir,
  writeFile as nodeWriteFile,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { isErr, isOk } from "ripthrow";
import { saveManifest } from "../core/io/manifest";

import { runMigrate, validateArtifacts } from "./migrate";

describe("migrate logic", () => {
  const testDir = join(process.cwd(), "temp-test-migrate");
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

  it("should fail validation if artifact is missing from Cargo.toml", async () => {
    await nodeWriteFile(
      "Cargo.toml",
      `
      [package]
      name = "my-app"
    `,
    );

    const config = {
      lang: "rust",
      artifacts: [{ type: "bin" as const, name: "wrong-name" }],
    };

    const result = await validateArtifacts(config);
    expect(isErr(result)).toBe(true);
    if (result.ok === false) {
      expect(result.error.message).toContain("Artifact 'wrong-name' not found in Cargo.toml");
    }
  });

  it("should succeed migration for valid config", async () => {
    await nodeWriteFile(
      "Cargo.toml",
      `
      [package]
      name = "my-app"
    `,
    );

    const config = {
      version: 1 as const,
      lang: "rust" as const,
      platform: "github" as const,
      artifacts: [{ type: "bin" as const, name: "my-app" }],
      targets: [],
    };

    await saveManifest(config);

    const result = await runMigrate();
    expect(isOk(result)).toBe(true);

    const workflowExists = await nodeExists(".github/workflows/refinery-build.yml");
    expect(workflowExists).toBe(true);
  });
});
