// biome-ignore-all lint/style/useExportsLast: types need to be defined before use
// biome-ignore-all lint/style/useNamingConvention: YAML output keys
// biome-ignore-all lint/complexity/useLiteralKeys: GHA env var names need bracket notation
import type { RefineryConfig } from "../../schema";
import { TRIPLES } from "./matrix-constants";

const DEFAULT_OUTPUT_PATTERN = "{name}-{os}-{arch}";
const TRAILING_DASH_RE = /-$/u;

export interface MatrixEntry {
  artifact: string;
  os: string;
  arch: string;
  abi?: string;
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
  linker?: string;
}

interface PackageFlags {
  has_deb: boolean;
  has_rpm: boolean;
  has_msi: boolean;
  has_archive: boolean;
  has_bin: boolean;
}

function getRunsOn(os: string, arch: string): string {
  if (arch === "arm64") {
    if (os === "linux") {
      return "ubuntu-24.04-arm";
    }
    if (os === "windows") {
      return "windows-11-arm";
    }
  }
  if (os === "linux") {
    return "ubuntu-latest";
  }
  if (os === "macos") {
    return "macos-latest";
  }
  if (os === "windows") {
    return "windows-latest";
  }

  return "ubuntu-latest";
}

function getAbiKey(os: string, abi: string | undefined): string | undefined {
  if (abi === undefined) {
    if (os === "windows") {
      return "msvc";
    }
    return;
  }
  if (os === "linux" && abi === "gnu") {
    return;
  }
  if (os === "windows" && abi === "msvc") {
    return;
  }

  return abi;
}

function getTargetTriple(os: string, arch: string, abi?: string): string {
  const abiKey = getAbiKey(os, abi);

  let key: string;

  if (abiKey === undefined) {
    key = `${os}/${arch}`;
  } else {
    key = `${os}/${arch}:${abiKey}`;
  }

  return TRIPLES[key] ?? "x86_64-unknown-linux-gnu";
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
  patterns: Map<string, string>,
): string {
  const pattern = patterns.get(target.for) ?? DEFAULT_OUTPUT_PATTERN;

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

function getLinker(triple: string): string | undefined {
  const linkers: Record<string, string> = {
    "armv7-unknown-linux-gnueabihf": "arm-linux-gnueabihf-gcc",
    "aarch64-unknown-linux-gnu": "aarch64-linux-gnu-gcc",
    "aarch64-unknown-linux-musl": "aarch64-linux-gnu-gcc",
    "i686-pc-windows-gnu": "i686-w64-mingw32-gcc",
    "x86_64-pc-windows-gnu": "x86_64-w64-mingw32-gcc",
  };

  return linkers[triple];
}

function getAptPackages(os: string, triple: string, packages: string[]): string[] {
  const apt: string[] = [];

  if (os !== "linux") {
    return apt;
  }

  if (triple.includes("musl")) {
    apt.push("musl-tools");
  }
  if (triple.startsWith("i686")) {
    apt.push("gcc-multilib");
  }
  if (triple.startsWith("armv7")) {
    apt.push("gcc-arm-linux-gnueabihf");
  }
  if (triple.startsWith("aarch64")) {
    apt.push("gcc-aarch64-linux-gnu");
  }
  if (packages.includes("rpm")) {
    apt.push("rpm");
  }

  return apt;
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
  patterns: Map<string, string>,
): MatrixEntry {
  const outputName = resolveOutputName(target, arch, patterns);
  const packages = target.packages ?? getDefaultPackages(target.os);
  const triple = getTargetTriple(target.os, arch, target.abi);
  const flags = buildPackageFlags(packages);

  let packageType = "tar.gz";

  if (packages.includes("zip")) {
    packageType = "zip";
  }

  let binExt = "";

  if (target.os === "windows") {
    binExt = ".exe";
  }

  const entry: MatrixEntry = {
    artifact: target.for,
    os: target.os,
    arch,
    runs_on: getRunsOn(target.os, arch),
    output_name: outputName,
    artifact_bin: target.for.replace(/-/gu, "_"),
    target_triple: triple,
    package_type: packageType,
    packages,
    ...flags,
    include_files: target.includeInPackage ?? [],
    apt_packages: getAptPackages(target.os, triple, packages),
    bin_ext: binExt,
  };

  if (target.abi) {
    entry.abi = target.abi;
  }

  const linker = getLinker(triple);

  if (linker) {
    entry.linker = linker;
  }

  return entry;
}

function buildMatrix(config: RefineryConfig): MatrixEntry[] {
  const entries: MatrixEntry[] = [];
  const map = new Map<string, string>();

  if (config.lang === "rust") {
    for (const a of config.artifacts ?? []) {
      if (a.type === "bin" && a.outputName) {
        map.set(a.name, a.outputName);
      }
    }
  }

  for (const t of config.targets ?? []) {
    for (const arch of t.arch) {
      entries.push(buildBaseEntry(t, arch, map));
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
