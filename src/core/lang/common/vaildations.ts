import type { z } from "zod";
import { Abi } from "../../types/abi";
import { Os } from "../../types/os";
import { Package } from "../../types/packages";

const DEFAULT_OUTPUT_PATTERN = "{name}-{os}-{arch}";
const TRAILING_DASH_RE = /-$/u;

function resolveOutputName(opts: {
  pattern: string;
  artifact: string;
  os: string;
  arch: string;
  abi: string | undefined;
}): string {
  let resolved = opts.pattern
    .replace("{name}", opts.artifact)
    .replace("{os}", opts.os)
    .replace("{arch}", opts.arch)
    .replace("{abi}", opts.abi ?? "");

  if (resolved === opts.artifact) {
    resolved = `${resolved}-${opts.os}-${opts.arch}`;
  }

  resolved = resolved.replace(TRAILING_DASH_RE, "");

  return resolved;
}

function checkArtifactCollisions(
  artifact: { name: string; type: string; outputName?: string | undefined },
  artIndex: number,
  targets: { os: string; arch: string[]; abi?: string | undefined }[],
  ctx: z.RefinementCtx,
): boolean {
  const pattern = artifact.outputName ?? DEFAULT_OUTPUT_PATTERN;
  const seen = new Set<string>();

  for (const target of targets) {
    for (const arch of target.arch) {
      const resolved = resolveOutputName({
        pattern,
        artifact: artifact.name,
        os: target.os,
        arch,
        abi: target.abi,
      });

      if (seen.has(resolved)) {
        ctx.addIssue({
          code: "custom",
          message: `Artifact '${artifact.name}' output name collision: multiple targets produce '${resolved}'. Add {os}, {arch}, or {abi} to outputName for uniqueness.`,
          path: ["artifacts", artIndex, "outputName"],
        });
        return false;
      }
      seen.add(resolved);
    }
  }
  return true;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: High complexity is inherent to the strict target platform validation rules.
export function validateBinaryTarget(
  data: {
    os: (typeof Os)[keyof typeof Os];
    abi?: (typeof Abi)[keyof typeof Abi] | undefined;
    packages?: (typeof Package)[keyof typeof Package][] | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  if (data.os === Os.macos && data.abi) {
    ctx.addIssue({
      code: "custom",
      message: "MacOS does not support ABIs",
      path: ["abi"],
    });
  }

  if (data.os === Os.linux && data.abi) {
    const allowed: (typeof Abi)[keyof typeof Abi][] = [Abi.gnu, Abi.musl];
    if (!allowed.includes(data.abi)) {
      ctx.addIssue({
        code: "custom",
        message: "Linux only supports 'gnu' or 'musl'",
        path: ["abi"],
      });
    }
  }

  if (data.os === Os.windows && data.abi) {
    const allowed: (typeof Abi)[keyof typeof Abi][] = [Abi.gnu, Abi.msvc];
    if (!allowed.includes(data.abi)) {
      ctx.addIssue({
        code: "custom",
        message: "Windows only supports 'msvc' or 'gnu'",
        path: ["abi"],
      });
    }
  }

  if (data.packages) {
    if (
      data.os !== Os.linux &&
      (data.packages.includes(Package.deb) || data.packages.includes(Package.rpm))
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Linux-specific packages (deb/rpm) are not allowed for other OS",
        path: ["packages"],
      });
    }

    if (data.os !== Os.windows && data.packages.includes(Package.msi)) {
      ctx.addIssue({
        code: "custom",
        message: "MSI packages are only allowed for Windows",
        path: ["packages"],
      });
    }
  }
}

/**
 * Validates that all targets point to valid artifacts and types match.
 */
export function validateConfigReferences(
  data: {
    artifacts: { name: string; type: string }[];
    targets: { id: string; for: string; type: string }[];
  },
  ctx: z.RefinementCtx,
): void {
  const artifactNames = new Set(data.artifacts.map((a) => a.name));

  for (const [index, target] of data.targets.entries()) {
    if (!artifactNames.has(target.for)) {
      ctx.addIssue({
        code: "custom",
        message: `Target '${target.id}' points to a non-existent artifact: '${target.for}'`,
        path: ["targets", index, "for"],
      });
    }

    const artifact = data.artifacts.find((a) => a.name === target.for);
    if (artifact && artifact.type !== target.type) {
      ctx.addIssue({
        code: "custom",
        message: `Target '${target.id}' type '${target.type}' does not match artifact '${target.for}' type '${artifact.type}'`,
        path: ["targets", index, "type"],
      });
    }
  }
}

/**
 * Validates that outputName patterns produce unique filenames across all targets.
 */
export function validateOutputNameCollisions(
  data: {
    artifacts: { name: string; type: string; outputName?: string | undefined }[];
    targets: { id: string; for: string; os: string; arch: string[]; abi?: string | undefined }[];
  },
  ctx: z.RefinementCtx,
): void {
  for (const [artIndex, artifact] of data.artifacts.entries()) {
    if (artifact.type === "bin") {
      const targets = data.targets.filter((t) => t.for === artifact.name);
      if (!checkArtifactCollisions(artifact, artIndex, targets, ctx)) {
        return;
      }
    }
  }
}
