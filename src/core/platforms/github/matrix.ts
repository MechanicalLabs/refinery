// biome-ignore-all lint/style/useExportsLast: types need to be defined before use
// biome-ignore-all lint/style/useNamingConvention: YAML output keys
// biome-ignore-all lint/complexity/useLiteralKeys: GHA env var names need bracket notation

import type { Result } from "ripthrow";
import { Err, Ok } from "ripthrow";
import { type AppError, Errors } from "../../../errors";
import type { RefineryConfig } from "../../schema";
import { LanguageRegistry } from "../../strategy/registry";
import { Runners } from "./constants";

export interface MatrixEntry {
  artifact: string;
  artifact_type: "bin" | "lib";
  os: string;
  arch: string;
  runs_on: string;
  output_name: string;
  artifact_bin: string;
  target_triple: string;
  packages: string[];
  has_deb: boolean;
  has_rpm: boolean;
  has_msi: boolean;
  has_archive: boolean;
  has_bin: boolean;
  include_files: string[];
  apt_packages: string[];
  bin_ext: string;
  headers: boolean;
  abi?: string | undefined;
  linker?: string | undefined;
  linker_env: string[];
  features: string[];
  features_str: string;
  default_features: boolean;
}

/**
 * Resolves the GHA runner label for a given OS and architecture.
 * Runner versions are pinned in constants.ts for reproducibility.
 */
function resolveGitHubRunner(os: string, arch: string): string {
  if (os === "macos") {
    return Runners.macos;
  }
  if (os === "windows") {
    return arch === "arm64" ? Runners.windowsArm : Runners.windows;
  }
  // Linux and WASM targets
  return arch === "arm64" ? Runners.linuxArm : Runners.linux;
}

interface PackageFlags {
  has_deb: boolean;
  has_rpm: boolean;
  has_msi: boolean;
  has_archive: boolean;
  has_bin: boolean;
}

function getPackageFlags(packages: string[]): PackageFlags {
  return {
    has_deb: packages.includes("deb"),
    has_rpm: packages.includes("rpm"),
    has_msi: packages.includes("msi"),
    has_archive: packages.includes("tar.gz") || packages.includes("zip"),
    has_bin: packages.includes("bin"),
  };
}

function resolveOutputName(
  pattern: string,
  ctx: { name: string; os: string; arch: string; abi?: string | undefined },
): string {
  let name = pattern
    .replace("{name}", ctx.name)
    .replace("{os}", ctx.os)
    .replace("{arch}", ctx.arch);

  if (ctx.abi) {
    name = name.replace("{abi}", ctx.abi);
  } else {
    // Clean up trailing hyphens if abi is missing and was part of the pattern
    name = name.replace("-{abi}", "").replace(".{abi}", "");
  }

  return name;
}

function buildBaseEntry(
  artifact: RefineryConfig["artifacts"][0],
  target: RefineryConfig["targets"][0],
  arch: string,
  langStrategy: {
    getTargetInfo: (
      os: string,
      arch: string,
      abi?: string,
    ) =>
      | {
          triple: string;
          linker?: string;
          aptPackages: string[];
          linkerEnv?: Record<string, string>;
        }
      | undefined;
  },
): Result<MatrixEntry, AppError> {
  const targetInfo = langStrategy.getTargetInfo(target.os, arch, target.abi);

  if (!targetInfo) {
    return Err(
      Errors.unsupportedTarget({
        triple: `${arch}-${target.os}${target.abi ? `-${target.abi}` : ""}`,
      }),
    );
  }

  const pkgFlags = getPackageFlags(target.packages || []);
  const binExt = target.os === "windows" ? ".exe" : "";

  const outputName = resolveOutputName(artifact.outputName || "{name}-{os}-{arch}", {
    name: artifact.name,
    os: target.os,
    arch,
    abi: target.abi,
  });

  const targetHeaders = (target as Record<string, unknown>)["headers"] as boolean | undefined;
  const headersEnabled = artifact.type === "lib" && (targetHeaders ?? artifact.headers ?? false);

  const artFeatures = (artifact as Record<string, unknown>)["features"] as string[] | undefined;
  const tgtFeatures = (target as Record<string, unknown>)["features"] as string[] | undefined;
  const features = tgtFeatures ?? artFeatures ?? [];

  const artDefaultFeatures = (artifact as Record<string, unknown>)["defaultFeatures"] as
    | boolean
    | undefined;
  const tgtDefaultFeatures = (target as Record<string, unknown>)["defaultFeatures"] as
    | boolean
    | undefined;
  const defaultFeatures = tgtDefaultFeatures ?? artDefaultFeatures ?? true;

  const aptPackages = [...targetInfo.aptPackages];
  if (pkgFlags.has_rpm && !aptPackages.includes("rpm")) {
    aptPackages.push("rpm");
  }

  const linkerEnv: string[] = [];
  if (targetInfo.linkerEnv) {
    for (const [k, v] of Object.entries(targetInfo.linkerEnv)) {
      linkerEnv.push(`${k}=${v}`);
    }
  }

  const entry: MatrixEntry = {
    artifact: artifact.name,
    artifact_type: artifact.type,
    os: target.os,
    arch,
    runs_on: resolveGitHubRunner(target.os, arch),
    output_name: outputName,
    artifact_bin: artifact.name,
    target_triple: targetInfo.triple,
    packages: target.packages || [],
    ...pkgFlags,
    include_files: target.includeInPackage ?? [],
    apt_packages: aptPackages,
    bin_ext: binExt,
    headers: headersEnabled,
    linker: targetInfo.linker,
    linker_env: linkerEnv,
    features,
    features_str: features.join(","),
    default_features: defaultFeatures,
  };

  if (target.abi) {
    entry.abi = target.abi;
  }

  return Ok(entry);
}

export function buildMatrix(config: RefineryConfig): Result<MatrixEntry[], AppError> {
  const langResult = LanguageRegistry.get(config.lang);
  if (!langResult.ok) {
    return Ok([]);
  }
  const langStrategy = langResult.value;

  const entries: MatrixEntry[] = [];

  for (const artifact of config.artifacts) {
    const targets = config.targets.filter(
      (t) => t.for === artifact.name && (t.type === undefined || t.type === artifact.type),
    );

    for (const target of targets) {
      for (const arch of target.arch) {
        const result = buildBaseEntry(artifact, target, arch, langStrategy);
        if (!result.ok) {
          return result;
        }
        entries.push(result.value);
      }
    }
  }

  return Ok(entries);
}
