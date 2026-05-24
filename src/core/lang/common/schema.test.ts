/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: it's a test */
/** biome-ignore-all lint/style/noNonNullAssertion: it's a test */
import { describe, expect, test } from "bun:test";
import { BaseConfigSchema } from "../../schema";
import { CommonBinaryArtifact } from "./schema/artifact";
import { CommonBinaryTarget } from "./schema/target";

describe("Common Schema", () => {
  test("CommonBinaryArtifact should require name", () => {
    const result = CommonBinaryArtifact.safeParse({
      type: "bin",
      name: "",
    });
    expect(result.success).toBe(false);
  });

  test("CommonBinaryTarget should require id and for", () => {
    const result = CommonBinaryTarget.safeParse({
      type: "bin",
      os: "linux",
      arch: ["x86_64"],
      abi: "gnu",
    });
    expect(result.success).toBe(false);
  });

  test("CommonBinaryTarget should validate with id and for", () => {
    const result = CommonBinaryTarget.safeParse({
      id: "linux-bin",
      for: "my-app",
      type: "bin",
      os: "linux",
      arch: ["x86_64"],
      abi: "gnu",
    });
    expect(result.success).toBe(true);
  });
});

describe("Base Config Schema Cross-Validation", () => {
  test("should fail if target.for points to non-existent artifact", () => {
    const result = BaseConfigSchema.safeParse({
      version: 1,
      platform: "github",
      lang: "rust",
      artifacts: [
        {
          type: "bin",
          name: "my-app",
        },
      ],
      targets: [
        {
          id: "linux-bin",
          for: "wrong-app",
          type: "bin",
          os: "linux",
          arch: ["x86_64"],
          abi: "gnu",
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toContain("points to a non-existent artifact");
    }
  });

  test("should fail if target type does not match artifact type", () => {
    const result = BaseConfigSchema.safeParse({
      version: 1,
      platform: "github",
      lang: "rust",
      artifacts: [
        {
          type: "lib",
          name: "my-lib",
        },
      ],
      targets: [
        {
          id: "linux-lib",
          for: "my-lib",
          type: "bin", // Wrong type
          os: "linux",
          arch: ["x86_64"],
          abi: "gnu",
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toContain(
        "type 'bin' does not match artifact 'my-lib' type 'lib'",
      );
    }
  });

  test("should pass with correct references", () => {
    const result = BaseConfigSchema.safeParse({
      version: 1,
      platform: "github",
      lang: "rust",
      artifacts: [
        {
          type: "bin",
          name: "my-app",
        },
      ],
      targets: [
        {
          id: "linux-bin",
          for: "my-app",
          type: "bin",
          os: "linux",
          arch: ["x86_64"],
          abi: "gnu",
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});
