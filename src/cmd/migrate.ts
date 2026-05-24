import path from "node:path";
import { type AsyncResult, buildAsync, Err, Ok } from "ripthrow";
import { exists, mkdir, readFile, writeFile } from "../core/io/fs";
import { loadManifest } from "../core/io/manifest";
import type { RefineryConfig } from "../core/schema";
import { LanguageRegistry, PlatformRegistry } from "../core/strategy/registry";
import type { StrategyContext } from "../core/strategy/types";
import { Errors } from "../errors";
import { printBranding } from "../ui";
import { logger } from "../ui/log";
import { sh } from "../utils/shell";
import type { Cmd } from "./types";

async function validateArtifacts(config: RefineryConfig): AsyncResult<void, Error> {
  const langResult = LanguageRegistry.get(config.lang);
  if (!langResult.ok) {
    return Ok();
  }
  return langResult.value.validateArtifacts(config);
}

async function validateTargets(config: RefineryConfig): AsyncResult<void, Error> {
  const allChecks = config.targets.flatMap((target) => {
    const include = target.includeInPackage ?? [];
    return include.map((file) => ({
      file,
      targetId: target.id,
    }));
  });

  const results = await Promise.all(
    allChecks.map(async (check) => ({
      ...check,
      exists: (await exists(check.file)).ok,
    })),
  );

  for (const result of results) {
    if (!result.exists) {
      const err = Errors.missingTargetFile({ file: result.file, targetId: result.targetId });
      return Promise.resolve(Err(err));
    }
  }

  return Ok();
}

async function runMigrate(): AsyncResult<void, Error> {
  const manifestRes = await loadManifest();
  if (!manifestRes.ok) {
    return manifestRes;
  }
  const config = manifestRes.value;

  return buildAsync(Promise.resolve(Ok(config)))
    .note("Loading refinery.toml")
    .mapErr((e): Error => e as Error)
    .andThen(async (config: RefineryConfig) => {
      const artifactRes = await validateArtifacts(config);
      if (!artifactRes.ok) {
        return artifactRes;
      }

      const targetRes = await validateTargets(config);
      if (!targetRes.ok) {
        return targetRes;
      }

      return Ok(config);
    })
    .note("Validating configuration against local project")
    .mapErr((e): Error => e as Error)
    .andThen((config: RefineryConfig) => {
      const platformResult = PlatformRegistry.get(config.platform);
      if (!platformResult.ok) {
        return platformResult;
      }

      const langResult = LanguageRegistry.get(config.lang);
      if (!langResult.ok) {
        return langResult;
      }

      const strategy = platformResult.value;
      const lang = langResult.value;
      const projectName = path.basename(process.cwd());

      const ctx: StrategyContext = {
        projectName,
        config,
        lang,
        cwd: process.cwd(),
        sys: {
          sh,
          fs: { exists: () => Promise.resolve(Ok()), readFile, writeFile, mkdir },
        },
      };

      return strategy.migrate(ctx);
    })
    .note("Generating CI platform configuration")
    .mapErr((e): Error => e as Error).result;
}

const migrateCmd: Cmd = {
  id: "migrate",
  description: "Sync refinery.toml to CI platform configuration",
  options: [],
  action: (): AsyncResult<void, Error> => {
    printBranding();

    return buildAsync(runMigrate())
      .tap(() => {
        logger.done("CI configuration generated successfully.");
      })
      .mapErr((e): Error => e as Error).result;
  },
};

export { migrateCmd, runMigrate, validateArtifacts };
