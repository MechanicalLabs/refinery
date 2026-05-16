import { isCancel, multiselect } from "@clack/prompts";
import pc from "picocolors";
import type { Result } from "ripthrow";
import { Err, Ok } from "ripthrow";
import type {
  CommonBinaryArtifact,
  CommonLibraryArtifact,
} from "../../core/lang/common/schema/artifact";
import type { CommonBinaryTarget, CommonLibraryTarget } from "../../core/lang/common/schema/target";
import { Abi } from "../../core/types/abi";
import { Arch } from "../../core/types/arch";
import { getCompatibleAbis } from "../../core/types/compatibility";
import type { Os } from "../../core/types/os";
import { Package } from "../../core/types/packages";
import { logger } from "../../ui/log";
import { step, toUiValidator } from "../../ui/prompt";
import { validateName } from "../../utils/naming";
import { type CoverageMap, TOTAL_ARCHS } from "./coverage";

type Artifact = CommonBinaryArtifact | CommonLibraryArtifact;
type Target = CommonBinaryTarget | CommonLibraryTarget;

interface CreateTargetOptions {
  baseInfo: { id: string; for: string; os: string };
  artifact: Artifact;
  archs: (keyof typeof Arch)[];
  abi: string | undefined;
  packages?: (typeof Package)[keyof typeof Package][];
  includeInPackage?: string[];
}

const WHITESPACE_REGEX = /\s+/u;

/**
 * Prompts for OS and a unique Target Identifier.
 */
export async function promptTargetBase(
  usedIds: Set<string>,
  osOptions: { value: string; label: string }[],
): Promise<{ id: string; os: string } | undefined | symbol> {
  let osResult: string | symbol;

  if (osOptions.length === 1 && osOptions[0]) {
    osResult = osOptions[0].value;
    logger.info(`Operating System: ${pc.cyan(osOptions[0].label)}`);
  } else {
    osResult = (await step.select("Operating System", osOptions)()) as string | symbol;
  }

  if (isCancel(osResult)) {
    return osResult;
  }

  const os = osResult;

  const id = await step.text(
    "Target Identifier (e.g. linux-gnu, linux-i686, windows-msvc, apple-silicon)",
    "",
    toUiValidator((v: string): Result<void, string> => {
      const res = validateName(v);
      if (!res.ok) {
        return res;
      }
      if (usedIds.has(v.trim())) {
        return Err("Target ID must be unique");
      }
      return Ok();
    }),
    "linux-gnu",
  )();

  if (isCancel(id)) {
    return id;
  }

  return { id: id as string, os };
}

/**
 * Filters and prompts for the appropriate ABI based on the selected OS.
 */
export async function promptAbi(
  artifactName: string,
  os: string,
  coverage: CoverageMap,
): Promise<string | undefined | symbol> {
  const abis = [
    { value: Abi.gnu, label: "GNU" },
    { value: Abi.musl, label: "musl" },
    { value: Abi.msvc, label: "MSVC" },
  ];

  const allowed = abis.filter((a: { value: string; label: string }): boolean => {
    const compatible = getCompatibleAbis(os);
    return compatible.includes(a.value as (typeof Abi)[keyof typeof Abi]);
  });

  if (allowed.length === 0) {
    return;
  }

  const filtered = allowed.filter((opt: { value: string; label: string }): boolean => {
    const key = `${artifactName}:${os}:${opt.value}`;
    const covered = coverage.get(key) ?? new Set();
    return covered.size < TOTAL_ARCHS;
  });

  if (filtered.length === 0) {
    return;
  }

  if (filtered.length === 1 && filtered[0]) {
    logger.info(`ABI: ${pc.cyan(filtered[0].label)}`);
    return filtered[0].value;
  }

  return await step.select("ABI", filtered)();
}

/**
 * Filters and prompts for available architectures based on previous selections.
 */
export async function promptArchitectures(
  artifactName: string,
  os: string,
  abi: string | undefined,
  coverage: CoverageMap,
): Promise<(keyof typeof Arch)[] | symbol> {
  const allArchs = [
    { value: Arch.x86_64, label: "x86_64" },
    { value: Arch.arm64, label: "arm64" },
    { value: Arch.armv7, label: "armv7" },
    { value: Arch.x86, label: "x86" },
  ].filter((opt) => {
    if (os === "macos") {
      return opt.value === Arch.arm64 || opt.value === Arch.x86_64;
    }
    if (os === "windows") {
      return opt.value !== Arch.armv7;
    }
    return true;
  });

  let abiKey = "none";
  if (abi) {
    abiKey = abi;
  }

  const key = `${artifactName}:${os}:${abiKey}`;
  const covered = coverage.get(key) ?? new Set();
  const available = allArchs.filter(
    (opt: { value: string; label: string }): boolean => !covered.has(opt.value),
  );

  if (available.length === 0) {
    return [];
  }

  const archs = (await step.multiSelect("Architectures", available)()) as
    | (keyof typeof Arch)[]
    | symbol;

  if (isCancel(archs)) {
    return archs;
  }

  return archs;
}

/**
 * Prompts for which package formats to build, filtered by OS.
 */
export async function promptPackages(
  os: string,
): Promise<(typeof Package)[keyof typeof Package][] | symbol> {
  const options: { value: string; label: string; hint?: string }[] = [
    { value: Package.bin, label: "Binary", hint: "raw executable" },
  ];

  if (os === "linux") {
    options.push(
      { value: Package.tar_gz, label: "tar.gz", hint: "compressed archive" },
      { value: Package.deb, label: ".deb", hint: "Debian/Ubuntu package" },
      { value: Package.rpm, label: ".rpm", hint: "Fedora/RHEL package" },
    );
  } else if (os === "windows") {
    options.push(
      { value: Package.zip, label: "ZIP", hint: "compressed archive" },
      { value: Package.msi, label: ".msi", hint: "Windows Installer" },
    );
  } else if (os === "macos") {
    options.push({ value: Package.tar_gz, label: "tar.gz", hint: "compressed archive" });
  }

  let defaultArchive: string;
  if (os === "windows") {
    defaultArchive = Package.zip;
  } else {
    defaultArchive = Package.tar_gz;
  }
  const defaults = [Package.bin, defaultArchive];

  const pkgs = await multiselect({
    message: "Package Formats",
    options,
    required: true,
    initialValues: defaults,
  });

  if (isCancel(pkgs)) {
    return pkgs;
  }

  return pkgs as (typeof Package)[keyof typeof Package][];
}

/**
 * Prompts for extra files to include in the archive.
 */
export async function promptIncludeFiles(): Promise<string[]> {
  const include = (await step.text(
    "Extra files to include in archive (space-separated, e.g. README.md LICENSE)",
    "",
    undefined,
    "",
  )()) as string;

  if (isCancel(include) || !include.trim()) {
    return [];
  }

  return include.trim().split(WHITESPACE_REGEX);
}

/**
 * Builds a type-safe target object based on the gathered answers.
 */
export async function createTargetObject({
  baseInfo,
  artifact,
  archs,
  abi,
  packages,
  includeInPackage,
}: CreateTargetOptions): Promise<Target | undefined | symbol> {
  const osType = baseInfo.os as (typeof Os)[keyof typeof Os];
  const archTypes = archs as (typeof Arch)[keyof typeof Arch][];

  if (artifact.type === "bin") {
    const binTarget: CommonBinaryTarget = {
      id: baseInfo.id,
      for: baseInfo.for,
      type: "bin",
      os: osType,
      arch: archTypes,
    };

    if (abi) {
      binTarget.abi = abi as (typeof Abi)[keyof typeof Abi];
    }
    if (packages && packages.length > 0) {
      binTarget.packages = packages;
    }
    if (includeInPackage && includeInPackage.length > 0) {
      binTarget.includeInPackage = includeInPackage;
    }

    return binTarget;
  }

  const headers = await step.confirm("Include headers?", false)();
  if (isCancel(headers)) {
    return headers;
  }

  const libTarget: CommonLibraryTarget = {
    id: baseInfo.id,
    for: baseInfo.for,
    type: "lib",
    os: osType,
    arch: archTypes,
    headers: Boolean(headers),
  };

  if (abi) {
    libTarget.abi = abi as (typeof Abi)[keyof typeof Abi];
  }

  return libTarget;
}
