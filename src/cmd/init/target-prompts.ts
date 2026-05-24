import { isCancel, multiselect } from "@clack/prompts";
import pc from "picocolors";
import type { Result } from "ripthrow";
import { Err, Ok } from "ripthrow";
import { existsSync } from "../../core/io/fs";
import type {
  CommonBinaryArtifact,
  CommonLibraryArtifact,
} from "../../core/lang/common/schema/artifact";
import type { CommonBinaryTarget, CommonLibraryTarget } from "../../core/lang/common/schema/target";
import type { LanguageCapabilities } from "../../core/types/capabilities";
import { logger } from "../../ui/log";
import { step, toUiValidator } from "../../ui/prompt";
import { validateName } from "../../utils/naming";
import { type CoverageMap, getAvailableAbis, getAvailableArchs } from "./coverage";

type Artifact = CommonBinaryArtifact | CommonLibraryArtifact;
type Target = CommonBinaryTarget | CommonLibraryTarget;

interface CreateTargetOptions {
  baseInfo: { id: string; for: string; os: string };
  artifact: Artifact;
  archs: string[];
  abi: string | undefined;
  packages?: string[];
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
 * Filters and prompts for the appropriate ABI based on the selected OS and language capabilities.
 */
export async function promptAbi(
  artifactName: string,
  os: string,
  coverage: CoverageMap,
  caps: LanguageCapabilities,
): Promise<string | undefined | symbol> {
  const available = getAvailableAbis(artifactName, os, coverage, caps);

  if (available.length === 0) {
    return;
  }

  const abiOptions = available.map((a) => ({ value: a, label: a.toUpperCase() }));
  if (abiOptions.length === 1 && abiOptions[0]) {
    logger.info(`ABI: ${pc.cyan(abiOptions[0].label)}`);
    return abiOptions[0].value;
  }

  return await step.select("ABI", abiOptions)();
}

/**
 * Filters and prompts for available architectures based on previous selections and language capabilities.
 */
export async function promptArchitectures(
  artifactName: string,
  os: string,
  abi: string | undefined,
  coverage: CoverageMap,
  caps: LanguageCapabilities,
): Promise<string[] | symbol> {
  const available = getAvailableArchs(artifactName, os, abi, coverage, caps);

  if (available.length === 0) {
    return [];
  }

  const archOptions = available.map((a) => ({ value: a, label: a }));
  const archs = (await step.multiSelect("Architectures", archOptions)()) as string[] | symbol;

  if (isCancel(archs)) {
    return archs;
  }

  return archs;
}

/**
 * Prompts for which package formats to build, filtered by OS and language capabilities.
 */
export async function promptPackages(
  os: string,
  caps: LanguageCapabilities,
): Promise<string[] | symbol> {
  const osPackages = caps.packages.find((p) => p.os === os);
  const options: { value: string; label: string; hint?: string }[] = (
    osPackages?.packages ?? []
  ).map((pkg) => {
    const hints: Record<string, string> = {
      bin: "raw executable",
      "tar.gz": "compressed archive",
      zip: "compressed archive",
      deb: "Debian/Ubuntu package",
      rpm: "Fedora/RHEL package",
      msi: "Windows Installer",
    };
    const hint = hints[pkg];
    return { value: pkg, label: pkg, ...(hint ? { hint } : {}) };
  });

  if (options.length === 0) {
    return [];
  }

  const defaults = caps.defaultPackages.filter((p) => (osPackages?.packages ?? []).includes(p));
  const pkgs = await multiselect({
    message: "Package Formats",
    options,
    required: true,
    initialValues: defaults,
  });

  if (isCancel(pkgs)) {
    return pkgs;
  }

  return pkgs as string[];
}

/**
 * Prompts for extra files to include in the archive.
 */
export async function promptIncludeFiles(): Promise<string[]> {
  const include = (await step.text(
    "Extra files to include in archive (space-separated, e.g. README.md LICENSE)",
    "",
    // @ts-expect-error: Implicit return undefined is required for success case
    (v: string): string | undefined => {
      if (!v.trim()) {
        return;
      }
      const files = v.trim().split(WHITESPACE_REGEX);
      for (const f of files) {
        if (!existsSync(f)) {
          return `File not found: ${f}`;
        }
      }
    },
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
  if (artifact.type === "bin") {
    const binTarget = {
      id: baseInfo.id,
      for: baseInfo.for,
      type: "bin" as const,
      os: baseInfo.os,
      arch: archs,
    } as CommonBinaryTarget;

    if (abi) {
      binTarget.abi = abi as CommonBinaryTarget["abi"];
    }
    if (packages && packages.length > 0) {
      binTarget.packages = packages as CommonBinaryTarget["packages"];
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

  const libTarget = {
    id: baseInfo.id,
    for: baseInfo.for,
    type: "lib" as const,
    os: baseInfo.os,
    arch: archs,
    headers: Boolean(headers),
  } as CommonLibraryTarget;

  if (abi) {
    libTarget.abi = abi as CommonLibraryTarget["abi"];
  }

  return libTarget;
}
