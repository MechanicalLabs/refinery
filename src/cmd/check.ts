import { type AsyncResult, buildAsync, Err, Ok } from "ripthrow";
import { loadManifest } from "../core/io/manifest";
import { TargetRegistry } from "../core/strategy/target-registry";
import { Errors } from "../errors";
import { printBranding } from "../ui";
import { logger } from "../ui/log";
import { sh } from "../utils/shell";
import type { Cmd } from "./types";

/**
 * Checks if a required tool exists in the system's PATH.
 */
async function checkTool(name: string, command: string): AsyncResult<void, Error> {
  const result = await sh`which ${command}`;
  if (result.ok && result.value.exitCode === 0) {
    logger.done(`  ✓ ${name} found`);
    return Ok();
  }
  logger.fail(`  ✗ ${name} NOT found (${command})`);
  return Err(Errors.toolMissing({ tool: name }));
}

/**
 * Validates the refinery manifest and the local environment.
 */
async function runCheck(): AsyncResult<void, Error> {
  logger.info("Checking refinery configuration and environment...");

  return buildAsync(loadManifest())
    .note("Loading refinery.toml")
    .mapErr((e) => e as Error)
    .andThen(async (config) => {
      logger.done("  ✓ refinery.toml is valid");

      logger.info("\nChecking toolchain:");
      if (config.lang === "rust") {
        const rustcRes = await checkTool("rustc", "rustc");
        if (!rustcRes.ok) {
          return rustcRes;
        }

        const cargoRes = await checkTool("cargo", "cargo");
        if (!cargoRes.ok) {
          return cargoRes;
        }

        const hasHeaders = config.targets.some((t) => t.type === "lib" && t.headers);
        if (hasHeaders) {
          const cbindgenRes = await checkTool("cbindgen", "cbindgen");
          if (!cbindgenRes.ok) {
            return cbindgenRes;
          }
        }
      }

      logger.info("\nChecking targets:");
      for (const target of config.targets) {
        for (const arch of target.arch) {
          const info = TargetRegistry.find({ os: target.os, arch, abi: target.abi });
          if (info) {
            logger.done(`  ✓ Target supported: ${info.triple}`);
          } else {
            const triple = `${arch}-${target.os}${target.abi ? `-${target.abi}` : ""}`;
            logger.fail(`  ✗ Target NOT supported: ${triple}`);
            return Err(Errors.unsupportedTarget({ triple }));
          }
        }
      }

      return Ok();
    })
    .note("Verifying project environment")
    .map(() => undefined)
    .mapErr((e) => e as Error).result;
}

const checkCmd: Cmd = {
  id: "check",
  description: "Validate refinery.toml and the local build environment",
  options: [],
  action: (): AsyncResult<void, Error> => {
    printBranding();
    return buildAsync(runCheck())
      .tap(() => {
        logger.done("\nEnvironment is ready for building.");
      })
      .mapErr((e) => e as Error).result;
  },
};

export { checkCmd };
