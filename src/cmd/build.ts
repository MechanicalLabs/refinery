// biome-ignore-all lint/performance/noAwaitInLoops: sequential builds are intentional
// biome-ignore-all lint/complexity/useLiteralKeys: bracket notation needed for TS index sig
// biome-ignore-all lint/nursery/noExcessiveLinesPerFile: build command contains sequential execution logic that is cohesive
import { type AsyncResult, Err, Ok } from "ripthrow";
import { exists, mkdir, readFile, writeFile } from "../core/io/fs";
import { loadManifest } from "../core/io/manifest";
import type { MatrixEntry } from "../core/platforms/github/matrix";
import { buildMatrix } from "../core/platforms/github/matrix";
import type { PostBuildStep, PreBuildStep, PublishStep, RefineryConfig } from "../core/schema";
import { LanguageRegistry } from "../core/strategy/registry";
import { TargetRegistry } from "../core/strategy/target-registry";
import type { AbstractStep, StrategyContext, TargetMetadata } from "../core/strategy/types";
import { printBranding } from "../ui";
import { logger } from "../ui/log";
import { resolveComposite } from "../utils/composite";
import { sh, shWithEnv } from "../utils/shell";
import type { Cmd } from "./types";

function entryToMetadata(entry: MatrixEntry): TargetMetadata {
  return {
    artifact: entry.artifact,
    artifactType: entry.artifact_type,
    os: entry.os,
    arch: entry.arch,
    abi: entry.abi ?? undefined,
    triple: entry.target_triple,
    outputName: entry.output_name,
    packages: entry.packages,
    includeFiles: entry.include_files,
    binExt: entry.bin_ext,
    headers: entry.headers,
    linker: entry.linker ?? undefined,
    artifactBin: entry.artifact_bin,
    aptPackages: entry.apt_packages,
  };
}

async function addTarget(triple: string): AsyncResult<void, Error> {
  const result = await sh`rustup target add ${triple}`;
  if (!result.ok) {
    return Err(new Error(`Failed to add target ${triple}: ${result.error.message}`));
  }
  return Ok();
}

async function installSystemDeps(target: TargetMetadata): AsyncResult<void, Error> {
  const targetInfo = TargetRegistry.getByTriple(target.triple, target.os);
  const apt = targetInfo?.aptPackages ?? [];
  if (target.packages.includes("rpm") && !apt.includes("rpm")) {
    apt.push("rpm");
  }

  if (apt.length === 0) {
    return Ok();
  }
  const result = await sh`sudo apt-get update && sudo apt-get install -y ${apt.join(" ")}`;
  if (!result.ok) {
    return Err(new Error(`Failed to install system deps: ${result.error.message}`));
  }
  return Ok();
}

function buildEnvForEntry(target: TargetMetadata, config: RefineryConfig): Record<string, string> {
  const targetInfo = TargetRegistry.getByTriple(target.triple, target.os);
  const env: Record<string, string> = { ...(targetInfo?.linkerEnv ?? {}) };

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

async function executeAbstractStep(
  step: AbstractStep,
  ctx: StrategyContext,
  target: TargetMetadata,
): AsyncResult<void, Error> {
  if (step.type === "shell") {
    // Basic condition filtering for local build
    if (step.if) {
      if (step.if.includes("matrix.artifact_type == 'bin'") && target.artifactType !== "bin") {
        return Ok();
      }
      if (step.if.includes("matrix.artifact_type == 'lib'") && target.artifactType !== "lib") {
        return Ok();
      }
      if (step.if.includes("matrix.headers == true") && !target.headers) {
        return Ok();
      }
    }

    const env = buildEnvForEntry(target, ctx.config);
    if (step.env) {
      Object.assign(env, step.env);
    }

    const result = await shWithEnv(env)`${step.run}`;
    if (!result.ok || result.value.exitCode !== 0) {
      const msg = result.ok ? result.value.stderr : result.error.message;
      return Err(new Error(`Step '${step.name}' failed: ${msg}`));
    }
    return Ok();
  }

  if (step.type === "builtin") {
    switch (step.builtin) {
      case "setup_toolchain":
        return addTarget(target.triple);
      case "setup_linker":
        if (target.os === "linux") {
          return installSystemDeps(target);
        }
        return Ok();
      case "package":
        // TODO: Implement local packaging or just skip for now
        return Ok();
      default:
        return Ok();
    }
  }

  return Ok();
}

async function buildSingleEntry(
  entry: MatrixEntry,
  ctx: StrategyContext,
): AsyncResult<void, Error> {
  const target = entryToMetadata(entry);

  if (ctx.config.pre_build) {
    const perTargetPreSteps = ctx.config.pre_build.filter((s) => s.targets !== "once");
    const preResult = await execSteps(perTargetPreSteps, ctx.config, entry);
    if (!preResult.ok) {
      return preResult;
    }
  }

  const setupSteps = ctx.lang.getSetupSteps(ctx, target);
  for (const s of setupSteps) {
    const res = await executeAbstractStep(s, ctx, target);
    if (!res.ok) {
      return res;
    }
  }

  const buildSteps = ctx.lang.getBuildSteps(ctx, target);
  for (const s of buildSteps) {
    const res = await executeAbstractStep(s, ctx, target);
    if (!res.ok) {
      return res;
    }
  }

  const exportSteps = ctx.lang.getExportSteps(ctx, target);
  for (const s of exportSteps) {
    const res = await executeAbstractStep(s, ctx, target);
    if (!res.ok) {
      return res;
    }
  }

  if (ctx.config.post_build) {
    const perTargetPostSteps = ctx.config.post_build.filter((s) => s.targets !== "once");
    const postResult = await execSteps(perTargetPostSteps, ctx.config, entry);
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
  const langResult = LanguageRegistry.get(config.lang);
  if (!langResult.ok) {
    return langResult;
  }

  const entries = getBuildEntries(config, targetId);
  if (entries.length === 0) {
    const msg = targetId ? `Target '${targetId}' not found` : "No build targets defined";
    return Err(new Error(msg));
  }

  const ctx: StrategyContext = {
    projectName: "refinery", // TODO: Get actual project name
    config,
    lang: langResult.value,
    cwd: process.cwd(),
    sys: {
      sh,
      fs: { exists, mkdir, readFile, writeFile },
    },
  };

  const preResult = await runPhaseSteps(config.pre_build, config, true);
  if (!preResult.ok) {
    return preResult;
  }

  for (const entry of entries) {
    const buildRes = await buildSingleEntry(entry, ctx);
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
