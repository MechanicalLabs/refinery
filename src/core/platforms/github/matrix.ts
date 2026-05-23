// biome-ignore-all lint/style/useExportsLast: types need to be defined before use
// biome-ignore-all lint/style/useNamingConvention: YAML output keys
// biome-ignore-all lint/complexity/useLiteralKeys: GHA env var names need bracket notation

import type { Arch } from "../../../core/types/arch";
import type { RefineryConfig } from "../../schema";
import { TargetRegistry } from "../../strategy/target-registry";
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
  package_type: string;
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
  arch: (typeof Arch)[keyof typeof Arch],
): MatrixEntry {
  const targetInfo = TargetRegistry.find({
    os: target.os,
    arch,
    abi: target.abi,
  });

  if (!targetInfo) {
    throw new Error(`Target info not found for ${target.os} ${arch}`);
  }

  const pkgFlags = getPackageFlags(target.packages || []);
  const binExt = target.os === "windows" ? ".exe" : "";

  const outputName = resolveOutputName(artifact.outputName || "{name}-{os}-{arch}", {
    name: artifact.name,
    os: target.os,
    arch,
    abi: target.abi,
  });

  const headersEnabled = artifact.type === "lib" && (artifact.headers ?? false);

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
    package_type: target.os === "windows" ? "zip" : "tar.gz",
    packages: target.packages || [],
    ...pkgFlags,
    include_files: target.includeInPackage ?? [],
    apt_packages: aptPackages,
    bin_ext: binExt,
    headers: headersEnabled,
    linker: targetInfo.linker,
    linker_env: linkerEnv,
  };

  if (target.abi) {
    entry.abi = target.abi;
  }

  return entry;
}

export function buildMatrix(config: RefineryConfig): MatrixEntry[] {
  const entries: MatrixEntry[] = [];

  for (const artifact of config.artifacts) {
    const targets = config.targets.filter((t) => t.for === artifact.name);

    for (const target of targets) {
      for (const arch of target.arch) {
        entries.push(buildBaseEntry(artifact, target, arch));
      }
    }
  }

  return entries;
}

export function buildReleaseEnv(config: RefineryConfig): Record<string, string> {
  const env: Record<string, string> = {};
  const r = config.release;

  if (!r) {
    return env;
  }

  if (r.strip) {
    env["CARGO_PROFILE_RELEASE_STRIP"] = "symbols";
  }
  if (r.lto) {
    env["CARGO_PROFILE_RELEASE_LTO"] = "true";
  }
  if (r.codegenUnits && r.codegenUnits > 0) {
    env["CARGO_PROFILE_RELEASE_CODEGEN_UNITS"] = String(r.codegenUnits);
  }
  if (r.panic === "abort") {
    env["CARGO_PROFILE_RELEASE_PANIC"] = "abort";
  }

  return env;
}
