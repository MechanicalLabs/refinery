// biome-ignore-all lint/nursery/noTernary: fine for simple ternaries
// biome-ignore-all lint/performance/noAwaitInLoops: sequential builds are intentional
// biome-ignore-all lint/complexity/useLiteralKeys: bracket notation needed for TS index sig
import pc from "picocolors";
import { type AsyncResult, Err, Ok } from "ripthrow";
import { loadManifest } from "../core/io/manifest";
import { getAptPackages, getLinkerConfig } from "../core/linker";
import type { MatrixEntry } from "../core/platforms/github/matrix";
import { buildMatrix } from "../core/platforms/github/matrix";
import type { RefineryConfig } from "../core/schema";
import { printBranding } from "../ui";
import { logger } from "../ui/log";
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

async function runBuild(targetId?: string): AsyncResult<void, Error> {
  const manifestResult = await loadManifest();
  if (!manifestResult.ok) {
    return manifestResult;
  }

  const config = manifestResult.value;
  const allEntries = buildMatrix(config);
  const entries = targetId
    ? allEntries.filter((e) => {
        const target = config.targets?.find((t) => t.id === targetId);
        if (!target) {
          return false;
        }
        return (
          target.for === e.artifact &&
          e.os === target.os &&
          target.arch.includes(e.arch as "x86_64" | "x86" | "arm64" | "armv7" | "wasm32")
        );
      })
    : allEntries;

  if (entries.length === 0) {
    const msg = targetId ? `Target '${targetId}' not found` : "No build targets defined";
    return Err(new Error(msg));
  }

  for (const entry of entries) {
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
