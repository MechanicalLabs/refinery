import path from "node:path";
import { type AsyncResult, Err, Ok } from "ripthrow";
import { exists, mkdir, readFile, writeFile } from "../core/io/fs";
import { loadManifest } from "../core/io/manifest";
import { PlatformRegistry } from "../core/strategy/registry";
import type { StrategyContext } from "../core/strategy/types";
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
      return Err(
        new Error(
          `Artifact '${artifact.name}' not found in Cargo.toml. ` +
            `Expected one of: ${[...cargoNames].join(", ") || "(none)"}. ` +
            "Run `refinery init` to regenerate artifact definitions from Cargo.toml.",
        ),
      );
    }
  }

  return Ok();
}

async function runMigrate(): AsyncResult<void, Error> {
  const manifestResult = await loadManifest();
  if (!manifestResult.ok) {
    return manifestResult;
  }

  const config = manifestResult.value;

  const validationResult = await validateArtifacts(config);
  if (!validationResult.ok) {
    return validationResult;
  }

  const platformResult = PlatformRegistry.get(config.platform);
  if (!platformResult.ok) {
    return platformResult;
  }

  const strategy = platformResult.value;
  const projectName = path.basename(process.cwd());

  const ctx: StrategyContext = {
    projectName,
    config,
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
  action: (): void => {
    printBranding();

    runMigrate().then((result) => {
      if (!result.ok) {
        logger.fail(result.error);
        process.exit(1);
      }

      logger.done("CI configuration generated successfully.");
    });
  },
};

export { migrateCmd, runMigrate, validateArtifacts };
