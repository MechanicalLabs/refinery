import { isCancel } from "@clack/prompts";
import { Err, Ok, type Result } from "ripthrow";
import type {
  CommonBinaryArtifact,
  CommonLibraryArtifact,
} from "../../core/lang/common/schema/artifact";
import type { CommonBinaryTarget, CommonLibraryTarget } from "../../core/lang/common/schema/target";
import { Abi } from "../../core/types/abi";
import { Arch } from "../../core/types/arch";
import { getCompatibleAbis, isAbiRequired } from "../../core/types/compatibility";
import type { Os } from "../../core/types/os";
import { logger } from "../../ui/log";
import { step, toUiValidator } from "../../ui/prompt";
import { validateName } from "../../utils/naming";
import { type CoverageMap, getAvailableOsOptions, TOTAL_ARCHS, updateCoverage } from "./coverage";

type Artifact = CommonBinaryArtifact | CommonLibraryArtifact;
type Target = CommonBinaryTarget | CommonLibraryTarget;

/**
 * Interactive wizard to define build targets for the project's artifacts.
 */
async function promptTargets(artifacts: Artifact[]): Promise<Target[] | undefined> {
  const targets: Target[] = [];
  const usedIds = new Set<string>();
  const coverage: CoverageMap = new Map();

  if (artifacts.length === 0) {
    return targets;
  }

  const addTargetChoice = await step.confirm("Would you like to add a build target?")();
  if (isCancel(addTargetChoice)) {
    return;
  }

  if (!addTargetChoice) {
    return targets;
  }

  let addAnother = true;
  while (addAnother) {
    // biome-ignore lint/performance/noAwaitInLoops: interactive terminal flows require sequential await
    const target = await promptSingleTarget(artifacts, usedIds, coverage);
    if (!target) {
      return;
    }

    targets.push(target);
    const addAnotherChoice = await step.confirm("Add another target?")();
    if (isCancel(addAnotherChoice)) {
      return;
    }
    addAnother = Boolean(addAnotherChoice);
  }

  return targets;
}

/**
 * Orchestrates the selection of OS, ABI, and architectures for a single target.
 */
async function promptSingleTarget(
  artifacts: Artifact[],
  usedIds: Set<string>,
  coverage: CoverageMap,
): Promise<Target | undefined> {
  const artifactName = await step.select(
    "For Artifact",
    artifacts.map((a: Artifact) => ({ value: a.name, label: a.name })),
  )();

  if (isCancel(artifactName)) {
    return;
  }

  const artifact = artifacts.find((a: Artifact): boolean => a.name === artifactName);

  if (!artifact) {
    return;
  }

  const osOptions = getAvailableOsOptions(artifact, coverage);
  if (osOptions.length === 0) {
    logger.warn(`All possible targets for artifact "${artifact.name}" are already covered.`);
    return;
  }

  const base = await promptTargetBase(usedIds, osOptions);
  if (!base) {
    return;
  }

  const id = base.id.trim();
  const abi = await promptAbi(artifact.name, base.os, coverage);
  if (isCancel(abi)) {
    return;
  }

  if (isAbiRequired(base.os) && !abi) {
    logger.warn(`No ABIs available for ${base.os}. Skipping target.`);
    return;
  }

  const archs = await promptArchitectures(artifact.name, base.os, abi as string, coverage);
  if (isCancel(archs)) {
    return;
  }

  if (archs.length === 0) {
    return;
  }

  usedIds.add(id);
  updateCoverage({ artifactName: artifact.name, os: base.os, abi: abi as string, archs, coverage });

  return await createTargetObject(
    { id, for: artifact.name, os: base.os },
    artifact,
    archs,
    abi as string,
  );
}

/**
 * Prompts for OS and a unique Target Identifier.
 */
async function promptTargetBase(
  usedIds: Set<string>,
  osOptions: { value: string; label: string }[],
): Promise<{ id: string; os: string } | undefined> {
  const os = await step.select("Operating System", osOptions)();
  if (isCancel(os)) {
    return;
  }

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
    return;
  }

  return { id, os: os as string };
}

/**
 * Builds a type-safe target object based on the gathered answers.
 */
async function createTargetObject(
  baseInfo: { id: string; for: string; os: string },
  artifact: Artifact,
  archs: (keyof typeof Arch)[],
  abi: string | undefined,
): Promise<Target | undefined> {
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

    return binTarget;
  }

  const headers = await step.confirm("Include headers?", false)();
  if (isCancel(headers)) {
    return;
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

/**
 * Filters and prompts for the appropriate ABI based on the selected OS.
 */
async function promptAbi(
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

  return await step.select("ABI", filtered)();
}

/**
 * Filters and prompts for available architectures based on previous selections.
 */
async function promptArchitectures(
  artifactName: string,
  os: string,
  abi: string | undefined,
  coverage: CoverageMap,
): Promise<(keyof typeof Arch)[]> {
  const allArchs = [
    { value: Arch.x86_64, label: "x86_64" },
    { value: Arch.arm64, label: "arm64" },
    { value: Arch.armv7, label: "armv7" },
    { value: Arch.x86, label: "x86" },
  ];

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
    let ctx = os;
    if (!isAbiRequired(os)) {
      ctx = `${os} (${abiKey})`;
    }
    logger.warn(`All architectures for ${ctx} are already covered.`);
    return [];
  }

  const archs = (await step.multiSelect("Architectures", available)()) as
    | (keyof typeof Arch)[]
    | symbol;

  if (isCancel(archs)) {
    return [];
  }

  if (archs.length === 0) {
    return [];
  }

  return archs;
}

export { promptTargets };
