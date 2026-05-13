import pc from "picocolors";
import { type AsyncResult, Err, matchErr, Ok } from "ripthrow";
import { loadManifest } from "../core/io/manifest";
import { Errors } from "../errors";
import { printBranding } from "../ui";
import { logger } from "../ui/log";
import { executeInitPipeline } from "./init/pipeline";
import { promptUser } from "./init/ui";
import type { Cmd } from "./types";

async function checkPreconditions(force: boolean): AsyncResult<boolean, Error> {
  const manifestResult = await loadManifest();

  if (manifestResult.ok) {
    if (force) {
      logger.warn(pc.yellow("Overwriting existing refinery.toml..."));
      return Ok(true);
    }
    return Err(Errors.manifestAlreadyExists());
  }

  const result = matchErr(manifestResult)
    .on(Errors.ioFileNotFound, () => Ok(true))
    .otherwise((err) => Err(err));

  return result as AsyncResult<boolean, Error>;
}

async function runInit(force = false): AsyncResult<void, Error> {
  const canContinue = await checkPreconditions(force);
  if (!canContinue.ok) {
    return canContinue;
  }

  const answers = await promptUser();
  if (!answers) {
    return Ok();
  }

  return executeInitPipeline(answers);
}

const initCmd: Cmd = {
  id: "init",
  description: "Initialize project",
  options: [{ flags: "-f, --force", description: "Overwrite existing refinery.toml" }],
  action: (options: Record<string, unknown>): void => {
    printBranding();
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript noPropertyAccessFromIndexSignature requires bracket notation
    const force = Boolean(options["force"]);

    runInit(force).then((result) => {
      if (!result.ok) {
        logger.fail(result.error);
        process.exit(1);
      }
    });
  },
};

export { initCmd };
