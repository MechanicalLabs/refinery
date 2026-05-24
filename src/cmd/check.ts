import { type AsyncResult, buildAsync, Err, Ok } from "ripthrow";
import { loadManifest } from "../core/io/manifest";
import { LanguageRegistry } from "../core/strategy/registry";
import { Errors } from "../errors";
import { printBranding } from "../ui";
import { logger } from "../ui/log";
import type { Cmd } from "./types";

/**
 * Validates the refinery manifest and the local environment.
 */
async function runCheck(options: { manifestOnly?: boolean } = {}): AsyncResult<void, Error> {
  const { manifestOnly = false } = options;
  logger.info("Checking refinery configuration...");

  return buildAsync(loadManifest())
    .note("Loading refinery.toml")
    .mapErr((e) => e as Error)
    .andThen(async (config) => {
      logger.done("  ✓ refinery.toml is valid");

      if (manifestOnly) {
        return Ok();
      }

      logger.info("\nChecking toolchain:");
      const langResult = LanguageRegistry.get(config.lang);
      if (langResult.ok) {
        const toolchainRes = await langResult.value.validateToolchain(config);
        if (!toolchainRes.ok) {
          return toolchainRes;
        }
      }

      logger.info("\nChecking targets:");
      const langStrategy = langResult.ok ? langResult.value : null;
      for (const target of config.targets) {
        for (const arch of target.arch) {
          const info = langStrategy?.getTargetInfo(target.os, arch, target.abi);
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
  options: [{ flags: "--manifest-only", description: "Validate only the refinery.toml file" }],
  action: (options: Record<string, unknown>): AsyncResult<void, Error> => {
    printBranding();
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript index signature requires bracket notation
    const manifestOnly = Boolean(options["manifestOnly"]);
    return buildAsync(runCheck({ manifestOnly }))
      .tap(() => {
        logger.done(manifestOnly ? "\nManifest is valid." : "\nEnvironment is ready for building.");
      })
      .mapErr((e) => e as Error).result;
  },
};

export { checkCmd };
