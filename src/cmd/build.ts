// biome-ignore-all lint/nursery/noTernary: fine for simple ternaries
// biome-ignore-all lint/performance/noAwaitInLoops: sequential builds are intentional
// biome-ignore-all lint/complexity/useLiteralKeys: bracket notation needed for TS index sig
import pc from "picocolors";
import { type AsyncResult, Err, Ok } from "ripthrow";
import { loadManifest } from "../core/io/manifest";
import { getAptPackages, getLinkerConfig } from "../core/linker";
import type { MatrixEntry } from "../core/platforms/github/matrix";
import { buildMatrix } from "../core/platforms/github/matrix";
import type { PostBuildStep, PreBuildStep, PublishStep, RefineryConfig } from "../core/schema";
import { printBranding } from "../ui";
import { logger } from "../ui/log";
import { resolveComposite } from "../utils/composite";
import { sh, shWithEnv } from "../utils/shell";
import type { Cmd } from "./types";

async function addTarget(triple: string): AsyncResult<void, Error> {
  const result = await sh`rustup target add ${triple}`;
  if (!result.ok) {
    return Err(new Error(`Failed to add target ${triple}: ${result.error.message}`));
  }
  return Ok();
}

async function installSystemDeps(triple: string, packages: string[]): AsyncResult<void, Error> {
  const apt = getAptPackages(triple, packages);
  if (apt.length === 0) {
    return Ok();
  }
  const result = await sh`sudo apt-get update && sudo apt-get install -y ${apt.join(" ")}`;
  if (!result.ok) {
    return Err(new Error(`Failed to install system deps: ${result.error.message}`));
  }
  return Ok();
}

function buildEnvForEntry(entry: MatrixEntry, config: RefineryConfig): Record<string, string> {
  const linkerCfg = getLinkerConfig(entry.target_triple);
  const env: Record<string, string> = { ...(linkerCfg?.linkerEnv ?? {}) };

  if (config.lang === "rust" && config.release) {
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
  }

  return env;
}

function shouldExecuteStep(
  step: PreBuildStep | PostBuildStep | PublishStep,
  config: RefineryConfig,
  currentEntry?: MatrixEntry,
): boolean {
  if (step.enabled === false || step.type === "builtin") {
    return false;
  }
  if (currentEntry) {
    if (step.targets === "once") {
      return false;
    }
    if (Array.isArray(step.targets)) {
      const targetIds = step.targets;
      const target = config.targets?.find((t) => targetIds.includes(t.id));
      if (!target) {
        return false;
      }
      if (target.for !== currentEntry.artifact || target.os !== currentEntry.os) {
        return false;
      }
      return target.arch.includes(
        currentEntry.arch as "x86_64" | "x86" | "arm64" | "armv7" | "wasm32",
      );
    }
    return true;
  }
  return !Array.isArray(step.targets);
}

async function execSteps(
  steps: (PreBuildStep | PostBuildStep | PublishStep)[],
  config: RefineryConfig,
  currentEntry?: MatrixEntry,
): AsyncResult<void, Error> {
  for (const step of steps) {
    if (shouldExecuteStep(step, config, currentEntry) && step.type === "composite") {
      const result = await resolveComposite(step.action, step.with);
      if (!result.ok) {
        return result;
      }
    }
  }
  return Ok();
}

async function runPhaseSteps(
  steps: (PreBuildStep | PostBuildStep | PublishStep)[] | undefined,
  config: RefineryConfig,
  filterOnce: boolean,
): AsyncResult<void, Error> {
  if (!steps) {
    return Ok();
  }
  const filtered = steps.filter((s) => (filterOnce ? s.targets === "once" : s.targets !== "once"));
  return await execSteps(filtered, config);
}

function getBuildEntries(config: RefineryConfig, targetId?: string): MatrixEntry[] {
  const allEntries = buildMatrix(config);
  if (!targetId) {
    return allEntries;
  }
  const target = config.targets?.find((t) => t.id === targetId);
  if (!target) {
    return [];
  }
  return allEntries.filter(
    (e) =>
      target.for === e.artifact &&
      e.os === target.os &&
      target.arch.includes(e.arch as "x86_64" | "x86" | "arm64" | "armv7" | "wasm32"),
  );
}

async function buildSingleEntry(
  entry: MatrixEntry,
  config: RefineryConfig,
): AsyncResult<void, Error> {
  if (config.pre_build) {
    const perTargetPreSteps = config.pre_build.filter((s) => s.targets !== "once");
    const preResult = await execSteps(perTargetPreSteps, config, entry);
    if (!preResult.ok) {
      return preResult;
    }
  }

  const triple = entry.target_triple;
  logger.info(`Building ${pc.cyan(entry.artifact)} for ${pc.yellow(triple)}`);

  const addResult = await addTarget(triple);
  if (!addResult.ok) {
    return addResult;
  }

  if (entry.os === "linux") {
    const depResult = await installSystemDeps(triple, entry.packages);
    if (!depResult.ok) {
      return depResult;
    }
  }

  const env = buildEnvForEntry(entry, config);
  const buildResult = await shWithEnv(env)`cargo build --release --target ${triple}`;
  if (!buildResult.ok) {
    return Err(new Error(`Build failed for ${triple}: ${buildResult.error.message}`));
  }

  logger.done(`  Built ${pc.cyan(triple)}`);

  if (config.post_build) {
    const perTargetPostSteps = config.post_build.filter((s) => s.targets !== "once");
    const postResult = await execSteps(perTargetPostSteps, config, entry);
    if (!postResult.ok) {
      return postResult;
    }
  }

  return Ok();
}

async function runBuild(targetId?: string): AsyncResult<void, Error> {
  const manifestResult = await loadManifest();
  if (!manifestResult.ok) {
    return manifestResult;
  }

  const config = manifestResult.value;
  const entries = getBuildEntries(config, targetId);

  if (entries.length === 0) {
    const msg = targetId ? `Target '${targetId}' not found` : "No build targets defined";
    return Err(new Error(msg));
  }

  const preResult = await runPhaseSteps(config.pre_build, config, true);
  if (!preResult.ok) {
    return preResult;
  }

  for (const entry of entries) {
    const buildRes = await buildSingleEntry(entry, config);
    if (!buildRes.ok) {
      return buildRes;
    }
  }

  const postResult = await runPhaseSteps(config.post_build, config, true);
  if (!postResult.ok) {
    return postResult;
  }

  if (config.publish) {
    const publishResult = await execSteps(config.publish, config);
    if (!publishResult.ok) {
      return publishResult;
    }
  }

  return Ok();
}

const buildCmd: Cmd = {
  id: "build",
  description: "Build targets defined in refinery.toml",
  options: [{ flags: "-t, --target <id>", description: "Build only the specified target ID" }],
  action: (options: Record<string, unknown>): void => {
    printBranding();
    const targetId = options["target"] as string | undefined;

    runBuild(targetId).then((result) => {
      if (!result.ok) {
        logger.fail(result.error);
        process.exit(1);
      }
      logger.done("Build complete.");
    });
  },
};

export { buildCmd };
