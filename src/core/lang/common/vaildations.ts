import type { z } from "zod";
import { Abi } from "../../types/abi";
import { Os } from "../../types/os";
import { Package } from "../../types/packages";

const LIB_ONLY_PACKAGES = new Set(["bin"]);
const LIB_SYSTEM_PACKAGES = new Set(["deb", "rpm", "msi"]);
const FORBIDDEN_LIB_PACKAGES = new Set([...LIB_ONLY_PACKAGES, ...LIB_SYSTEM_PACKAGES]);

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
 * Validates that all targets point to valid artifacts and type matches.
 */
export function validateConfigReferences(
  data: {
    artifacts: { name: string; type: string }[];
    targets: {
      id: string;
      for: string;
      type?: string;
      os?: string;
      arch?: string[];
      packages?: string[];
      features?: string[];
      defaultFeatures?: boolean;
    }[];
  },
  ctx: z.RefinementCtx,
): void {
  const artifactNames = new Set(data.artifacts.map((a) => a.name));
  let wasmCount = 0;

  for (const [index, target] of data.targets.entries()) {
    if (!artifactNames.has(target.for)) {
      ctx.addIssue({
        code: "custom",
        message: `Target '${target.id}' points to a non-existent artifact: '${target.for}'`,
        path: ["targets", index, "for"],
      });
    }

    const matchingArtifacts = data.artifacts.filter((a) => a.name === target.for);
    const [firstMatch] = matchingArtifacts;
    if (firstMatch && target.type !== undefined) {
      const match = matchingArtifacts.find((a) => a.type === target.type);
      if (!match) {
        ctx.addIssue({
          code: "custom",
          message: `Target '${target.id}' type '${target.type}' does not match artifact '${target.for}' type '${firstMatch.type}'`,
          path: ["targets", index, "type"],
        });
      }
    }

    if (target.arch?.includes("wasm32")) {
      wasmCount++;
      if (firstMatch && firstMatch.type !== "lib") {
        ctx.addIssue({
          code: "custom",
          message: `Target '${target.id}' includes wasm32 architecture but artifact '${target.for}' is type '${firstMatch.type}'. wasm32 is only allowed for library artifacts.`,
          path: ["targets", index, "arch"],
        });
      }
    }

    if (firstMatch?.type === "lib" && target.packages) {
      const invalid = target.packages.filter((p) => FORBIDDEN_LIB_PACKAGES.has(p));
      if (invalid.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: `Target '${target.id}' is for a library artifact but includes package(s): ${invalid.join(", ")}. These packages are only valid for binary artifacts.`,
          path: ["targets", index, "packages"],
        });
      }
    }
  }

  if (wasmCount > 1) {
    ctx.addIssue({
      code: "custom",
      message: `wasm32 architecture is defined ${wasmCount} times across targets. wasm32 can only be exported once.`,
      path: ["targets"],
    });
  }
}
