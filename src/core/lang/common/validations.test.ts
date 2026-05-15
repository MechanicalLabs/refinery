import { describe, expect, it } from "bun:test";
import type { z } from "zod";
import { Abi } from "../../types/abi";
import { Os } from "../../types/os";
import { Package } from "../../types/packages";
import {
  validateBinaryTarget,
  validateConfigReferences,
  validateOutputNameCollisions,
} from "./vaildations";

const createMockCtx = (): z.RefinementCtx => {
  const issues: z.ZodIssue[] = [];
  return {
    issues,
    addIssue: (issue: z.ZodIssue) => issues.push(issue),
  } as unknown as z.RefinementCtx;
};

describe("validateBinaryTarget", () => {
  it("should allow valid combinations", () => {
    const ctx = createMockCtx();
    validateBinaryTarget({ os: Os.linux, abi: Abi.gnu, packages: [Package.tar_gz] }, ctx);
    expect((ctx as unknown as { issues: z.ZodIssue[] }).issues).toHaveLength(0);
  });

  it("should reject MacOS with ABI", () => {
    const ctx = createMockCtx();
    validateBinaryTarget({ os: Os.macos, abi: Abi.gnu }, ctx);
    expect((ctx as unknown as { issues: z.ZodIssue[] }).issues).toHaveLength(1);
    expect((ctx as unknown as { issues: z.ZodIssue[] }).issues[0]?.message).toBe(
      "MacOS does not support ABIs",
    );
  });

  it("should reject invalid Linux ABI", () => {
    const ctx = createMockCtx();
    validateBinaryTarget({ os: Os.linux, abi: Abi.msvc }, ctx);
    expect((ctx as unknown as { issues: z.ZodIssue[] }).issues).toHaveLength(1);
    expect((ctx as unknown as { issues: z.ZodIssue[] }).issues[0]?.message).toBe(
      "Linux only supports 'gnu' or 'musl'",
    );
  });

  it("should reject Linux packages on non-Linux OS", () => {
    const ctx = createMockCtx();
    validateBinaryTarget({ os: Os.macos, packages: [Package.deb] }, ctx);
    expect((ctx as unknown as { issues: z.ZodIssue[] }).issues).toHaveLength(1);
    expect((ctx as unknown as { issues: z.ZodIssue[] }).issues[0]?.message).toBe(
      "Linux-specific packages (deb/rpm) are not allowed for other OS",
    );
  });
});

describe("validateConfigReferences", () => {
  it("should reject non-existent artifact references", () => {
    const ctx = createMockCtx();
    validateConfigReferences(
      {
        artifacts: [{ name: "app", type: "bin" }],
        targets: [{ id: "t1", for: "wrong-app", type: "bin" }],
      },
      ctx,
    );
    expect((ctx as unknown as { issues: z.ZodIssue[] }).issues).toHaveLength(1);
    expect((ctx as unknown as { issues: z.ZodIssue[] }).issues[0]?.message).toContain(
      "points to a non-existent artifact",
    );
  });

  it("should reject type mismatch between target and artifact", () => {
    const ctx = createMockCtx();
    validateConfigReferences(
      {
        artifacts: [{ name: "app", type: "lib" }],
        targets: [{ id: "t1", for: "app", type: "bin" }],
      },
      ctx,
    );
    expect((ctx as unknown as { issues: z.ZodIssue[] }).issues).toHaveLength(1);
    expect((ctx as unknown as { issues: z.ZodIssue[] }).issues[0]?.message).toContain(
      "type 'bin' does not match artifact 'app' type 'lib'",
    );
  });
});

describe("validateOutputNameCollisions", () => {
  it("should reject colliding output names", () => {
    const ctx = createMockCtx();
    validateOutputNameCollisions(
      {
        artifacts: [{ name: "app", type: "bin", outputName: "static-name" }],
        targets: [{ id: "t1", for: "app", os: "linux", arch: ["x86_64", "arm64"] }],
      },
      ctx,
    );
    expect((ctx as unknown as { issues: z.ZodIssue[] }).issues).toHaveLength(1);
    expect((ctx as unknown as { issues: z.ZodIssue[] }).issues[0]?.message).toContain(
      "output name collision",
    );
  });

  it("should allow unique output names via patterns", () => {
    const ctx = createMockCtx();
    validateOutputNameCollisions(
      {
        artifacts: [{ name: "app", type: "bin", outputName: "{name}-{os}-{arch}" }],
        targets: [{ id: "t1", for: "app", os: "linux", arch: ["x86_64", "arm64"] }],
      },
      ctx,
    );
    expect((ctx as unknown as { issues: z.ZodIssue[] }).issues).toHaveLength(0);
  });
});
