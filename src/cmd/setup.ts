// biome-ignore-all lint/performance/noAwaitInLoops: sequential setup is required for system stability
import pc from "picocolors";
import { type AsyncResult, buildAsync, Ok } from "ripthrow";
import { loadManifest } from "../core/io/manifest";
import { buildMatrix } from "../core/platforms/github/matrix";
import { LocalEnv } from "../core/strategy/local-env";
import { LanguageRegistry } from "../core/strategy/registry";
import { printBranding } from "../ui";
import { logger } from "../ui/log";
import type { Cmd } from "./types";

/**
 * Orchestrates the environment setup for all defined targets.
 * This includes installing toolchains and system-level dependencies.
 */
async function runSetup(dryRun = false): AsyncResult<void, Error> {
  const manifestRes = await loadManifest();
  if (!manifestRes.ok) {
    return manifestRes;
  }
  const config = manifestRes.value;

  const langResult = LanguageRegistry.get(config.lang);
  if (!langResult.ok) {
    logger.warn(`Language '${config.lang}' not supported. Nothing to set up.`);
    return Ok();
  }
  const lang = langResult.value;

  const matrixResult = buildMatrix(config);
  if (!matrixResult.ok) {
    return matrixResult;
  }
  const entries = matrixResult.value;
  if (entries.length === 0) {
    logger.warn("No targets defined in refinery.toml. Nothing to set up.");
    return Ok();
  }

  if (dryRun) {
    logger.info(pc.cyan("Dry-run mode: Previsualizing system setup."));
  }

  for (const entry of entries) {
    const target = {
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
      features: entry.features_str,
      defaultFeatures: entry.default_features,
    };

    logger.info(`Setting up environment for ${pc.green(entry.target_triple)}...`);

    // Setup toolchain
    const toolchain = lang.getToolchainVersion(config);
    const toolchainRes = await LocalEnv.setupToolchain(entry.target_triple, toolchain, dryRun);
    if (!toolchainRes.ok) {
      return toolchainRes;
    }

    // Setup system deps (Linux only)
    if (entry.os === "linux") {
      const depsRes = await LocalEnv.installSystemDeps(target, lang, dryRun);
      if (!depsRes.ok) {
        return depsRes;
      }
    }
  }

  return Ok();
}

/**
 * Command definition for 'refinery setup'.
 */
const setupCmd: Cmd = {
  id: "setup",
  description: "Install required system dependencies and toolchains for all targets",
  options: [{ flags: "--dry-run", description: "Preview setup actions without executing them" }],
  action: (options: Record<string, unknown>): AsyncResult<void, Error> => {
    printBranding();
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket notation
    const dryRun = Boolean(options["dryRun"]);

    return buildAsync(runSetup(dryRun))
      .tap(() => {
        logger.done(dryRun ? "Dry-run setup complete." : "System setup complete.");
      })
      .mapErr((e): Error => e as Error).result;
  },
};

export { setupCmd };
