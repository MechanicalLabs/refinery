import path from "node:path";
import { type AsyncResult, AsyncResultBuilder, buildAsync, Ok } from "ripthrow";
import { exists, mkdir, readFile, writeFile } from "../core/io/fs";
import { loadManifest } from "../core/io/manifest";
import type { RefineryConfig } from "../core/schema";
import { LanguageRegistry, PlatformRegistry } from "../core/strategy/registry";
import type { StrategyContext } from "../core/strategy/types";
import { Errors } from "../errors";
import { printBranding } from "../ui";
import { logger } from "../ui/log";
import { parseCargoToml } from "../utils/cargo";
import { sh } from "../utils/shell";
import type { Cmd } from "./types";

async function validateArtifacts(config: {
  lang: string;
  artifacts?: { name: string; type: string }[];
}): AsyncResult<void, Error> {
  if (config.lang !== "rust") {
    return Ok();
  }

  const hasCargo = await exists("Cargo.toml");
  if (!hasCargo.ok) {
    return Ok();
  }

  const cargoResult = await readFile("Cargo.toml");
  if (!cargoResult.ok) {
    return Ok();
  }

  const info = parseCargoToml(cargoResult.value);
  const cargoNames = new Set<string>();

  let bins: string[];
  if (info.binNames.length > 0) {
    bins = info.binNames;
  } else {
    bins = [info.packageName];
  }
  for (const name of bins) {
    cargoNames.add(name);
  }
  for (const name of info.libNames) {
    cargoNames.add(name);
  }

  for (const artifact of config.artifacts ?? []) {
    if (!cargoNames.has(artifact.name)) {
      return AsyncResultBuilder.err<void, Error>(
        Errors.artifactValidationFailed({
          reason:
            `Artifact '${artifact.name}' not found in Cargo.toml. ` +
            `Expected one of: ${[...cargoNames].join(", ") || "(none)"}. ` +
            "Run `refinery init` to regenerate artifact definitions from Cargo.toml.",
        }),
      ).result;
    }
  }

  return Ok();
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
      return AsyncResultBuilder.err<void, Error>(
        Errors.missingTargetFile({ file: result.file, targetId: result.targetId }),
      ).result;
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

  const artifactRes = await validateArtifacts(config);
  if (!artifactRes.ok) {
    return artifactRes;
  }

  const targetRes = await validateTargets(config);
  if (!targetRes.ok) {
    return targetRes;
  }

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
}

const migrateCmd: Cmd = {
  id: "migrate",
  description: "Sync refinery.toml to CI platform configuration",
  options: [],
  action: (): AsyncResult<void, Error> => {
    printBranding();

    return buildAsync(runMigrate()).tap(() => {
      logger.done("CI configuration generated successfully.");
    }).result;
  },
};

export { migrateCmd, runMigrate, validateArtifacts };
