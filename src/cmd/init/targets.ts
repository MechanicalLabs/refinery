import { isCancel } from "@clack/prompts";
import pc from "picocolors";
import type {
  CommonBinaryArtifact,
  CommonLibraryArtifact,
} from "../../core/lang/common/schema/artifact";
import type { CommonBinaryTarget, CommonLibraryTarget } from "../../core/lang/common/schema/target";
import { isAbiRequired } from "../../core/types/compatibility";
import { Package } from "../../core/types/packages";
import { logger } from "../../ui/log";
import { step } from "../../ui/prompt";
import { type CoverageMap, getAvailableOsOptions, updateCoverage } from "./coverage";
import {
  createTargetObject,
  promptAbi,
  promptArchitectures,
  promptIncludeFiles,
  promptPackages,
  promptTargetBase,
} from "./target-prompts";

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

  const availableArtifacts = artifacts.filter((a) => getAvailableOsOptions(a, coverage).length > 0);
  if (availableArtifacts.length === 0) {
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
    const remaining = artifacts.filter((a) => getAvailableOsOptions(a, coverage).length > 0);
    if (remaining.length === 0) {
      break;
    }

    // biome-ignore lint/performance/noAwaitInLoops: interactive terminal flows require sequential await
    const target = await promptSingleTarget(remaining, usedIds, coverage);
    if (isCancel(target)) {
      return;
    }
    if (target) {
      targets.push(target);
    }

    const stillAvailable = artifacts.filter((a) => getAvailableOsOptions(a, coverage).length > 0);
    if (stillAvailable.length === 0) {
      break;
    }

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
): Promise<Target | undefined | symbol> {
  const artifact = await selectArtifact(artifacts);
  if (isCancel(artifact) || !artifact) {
    return artifact;
  }

  const osOptions = getAvailableOsOptions(artifact, coverage);
  if (osOptions.length === 0) {
    logger.warn(`All possible targets for artifact "${artifact.name}" are already covered.`);
    return;
  }

  const base = await promptTargetBase(usedIds, osOptions);
  if (isCancel(base) || !base) {
    return base;
  }

  const abi = await promptAbi(artifact.name, base.os, coverage);
  if (isCancel(abi)) {
    return abi;
  }
  if (isAbiRequired(base.os) && !abi) {
    logger.warn(`No ABIs available for ${base.os}. Skipping target.`);
    return;
  }

  const archs = await promptArchitectures(artifact.name, base.os, abi as string, coverage);
  if (isCancel(archs)) {
    return archs;
  }
  if (archs.length === 0) {
    return;
  }

  const pkgs = await promptPackages(base.os);
  if (isCancel(pkgs)) {
    return pkgs;
  }

  const hasArchive = pkgs.includes(Package.tar_gz) || pkgs.includes(Package.zip);
  let includeFiles: string[] = [];
  if (hasArchive) {
    includeFiles = await promptIncludeFiles();
    if (isCancel(includeFiles)) {
      return includeFiles;
    }
  }

  usedIds.add(base.id.trim());
  updateCoverage({ artifactName: artifact.name, os: base.os, abi: abi as string, archs, coverage });

  return await createTargetObject({
    baseInfo: { id: base.id.trim(), for: artifact.name, os: base.os },
    artifact,
    archs,
    abi: abi as string,
    packages: pkgs,
    includeInPackage: includeFiles,
  });
}

/**
 * Helper to select an artifact if multiple are available.
 */
async function selectArtifact(artifacts: Artifact[]): Promise<Artifact | undefined | symbol> {
  if (artifacts.length === 1 && artifacts[0]) {
    logger.info(`For Artifact: ${pc.cyan(artifacts[0].name)}`);
    return artifacts[0];
  }

  const name = await step.select(
    "For Artifact",
    artifacts.map((a: Artifact) => ({ value: a.name, label: a.name })),
  )();

  if (isCancel(name)) {
    return name;
  }
  return artifacts.find((a: Artifact): boolean => a.name === name);
}

export { promptTargets };
