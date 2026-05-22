// biome-ignore-all lint/style/useExportsLast: types need to be defined before use
// biome-ignore-all lint/style/useNamingConvention: YAML output keys
// biome-ignore-all lint/complexity/useLiteralKeys: GHA env var names need bracket notation
import type { RefineryConfig } from "../../schema";
import { TargetRegistry } from "../../strategy/target-registry";

const DEFAULT_OUTPUT_PATTERN = "{name}-{os}-{arch}";
const TRAILING_DASH_RE = /-$/u;

export interface MatrixEntry {
  artifact: string;
  artifact_type: "bin" | "lib";
  os: string;
  arch: string;
  abi?: string | undefined;
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
  linker?: string | undefined;
}

interface PackageFlags {
  has_deb: boolean;
  has_rpm: boolean;
  has_msi: boolean;
  has_archive: boolean;
  has_bin: boolean;
}

function getDefaultPackages(os: string): string[] {
  let archive = "tar.gz";
  if (os === "windows") {
    archive = "zip";
  }
  return ["bin", archive];
}

function resolveOutputName(
  target: RefineryConfig["targets"][0],
  arch: string,
  artifacts: Map<string, RefineryConfig["artifacts"][0]>,
): string {
  const art = artifacts.get(`${target.for}:${target.type}`);
  let pattern = DEFAULT_OUTPUT_PATTERN;
  if (art && art.type === "bin" && art.outputName) {
    pattern = art.outputName;
  }

  let res = pattern
    .replace("{name}", target.for)
    .replace("{os}", target.os)
    .replace("{arch}", arch)
    .replace("{abi}", target.abi ?? "");

  res = res.replace(TRAILING_DASH_RE, "");

  if (res !== target.for) {
    return res;
  }

  return `${res}-${target.os}-${arch}`;
}

function buildPackageFlags(packages: string[]): PackageFlags {
  return {
    has_deb: packages.includes("deb"),
    has_rpm: packages.includes("rpm"),
    has_msi: packages.includes("msi"),
    has_archive: packages.includes("tar.gz") || packages.includes("zip"),
    has_bin: packages.includes("bin"),
  };
}

function buildBaseEntry(
  target: RefineryConfig["targets"][0],
  arch: string,
  artifacts: Map<string, RefineryConfig["artifacts"][0]>,
): MatrixEntry | undefined {
  const targetInfo = TargetRegistry.find({
    os: target.os,
    arch,
    abi: target.abi,
  });

  if (!targetInfo) {
    return undefined;
  }

  const outputName = resolveOutputName(target, arch, artifacts);
  const packages = target.packages ?? getDefaultPackages(target.os);
  const flags = buildPackageFlags(packages);

  let packageType = "tar.gz";
  if (packages.includes("zip")) {
    packageType = "zip";
  }

  let binExt = "";
  if (target.os === "windows" && target.type === "bin") {
    binExt = ".exe";
  }

  const art = artifacts.get(`${target.for}:${target.type}`);
  const headersEnabled =
    (target.type === "lib" && target.headers) || (art?.type === "lib" && art.headers);

  const aptPackages = [...targetInfo.aptPackages];
  if (packages.includes("rpm") && !aptPackages.includes("rpm")) {
    aptPackages.push("rpm");
  }

  const entry: MatrixEntry = {
    artifact: target.for,
    artifact_type: target.type,
    os: target.os,
    arch,
    runs_on: targetInfo.runsOn,
    output_name: outputName,
    artifact_bin: target.for.replace(/-/gu, "_"),
    target_triple: targetInfo.triple,
    package_type: packageType,
    packages,
    ...flags,
    include_files: target.includeInPackage ?? [],
    apt_packages: aptPackages,
    bin_ext: binExt,
    headers: headersEnabled,
    linker: targetInfo.linker,
  };

  if (target.abi) {
    entry.abi = target.abi;
  }

  return entry;
}

function buildMatrix(config: RefineryConfig): MatrixEntry[] {
  const entries: MatrixEntry[] = [];
  const artifactMap = new Map<string, RefineryConfig["artifacts"][0]>();

  if (config.lang === "rust") {
    for (const a of config.artifacts ?? []) {
      artifactMap.set(`${a.name}:${a.type}`, a);
    }
  }

  for (const t of config.targets ?? []) {
    for (const arch of t.arch) {
      const entry = buildBaseEntry(t, arch, artifactMap);
      if (entry) {
        entries.push(entry);
      }
    }
  }

  return entries;
}

function buildReleaseEnv(config: RefineryConfig): Record<string, string> | undefined {
  if (config.lang !== "rust" || !config.release) {
    return;
  }

  const env: Record<string, string> = {};
  const r = config.release;

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

export { buildMatrix, buildReleaseEnv };
