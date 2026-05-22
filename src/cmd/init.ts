import pc from "picocolors";
import { type AsyncResult, Err, matchErr, Ok, type Result } from "ripthrow";
import { loadManifest } from "../core/io/manifest";
import { type AppError, Errors } from "../errors";
import { printBranding } from "../ui";
import { logger } from "../ui/log";
import { executeInitPipeline } from "./init/pipeline";
import { promptUser } from "./init/ui";
import type { Cmd } from "./types";

/**
 * Checks if the project is in a valid state to be initialized.
 * Uses matchErr.exhaustive() to explicitly handle every possible AppError.
 */
async function checkPreconditions(force: boolean): AsyncResult<boolean, Error> {
  const manifestResult = await loadManifest();

  if (manifestResult.ok) {
    if (force) {
      logger.warn(pc.yellow("Overwriting existing refinery.toml..."));
      return Ok(true);
    }
    return Err(Errors.manifestAlreadyExists());
  }

  return matchErr(manifestResult as Result<never, AppError>)
    .on(Errors.manifestNotFound, () => Ok(true))
    .on(Errors.validationError, (e) => Err(e))
    .on(Errors.ioFileNotFound, (e) => Err(e))
    .on(Errors.projectNameRequired, (e) => Err(e))
    .on(Errors.projectNameInvalid, (e) => Err(e))
    .on(Errors.manifestAlreadyExists, (e) => Err(e))
    .on(Errors.missingTargetFile, (e) => Err(e))
    .on(Errors.invalidStrategy, (e) => Err(e))
    .on(Errors.strategyInitFailed, (e) => Err(e))
    .on(Errors.targetAdditionFailed, (e) => Err(e))
    .on(Errors.systemDepsInstallFailed, (e) => Err(e))
    .on(Errors.stepExecutionFailed, (e) => Err(e))
    .on(Errors.targetNotFound, (e) => Err(e))
    .on(Errors.noTargetsDefined, (e) => Err(e))
    .on(Errors.artifactValidationFailed, (e) => Err(e))
    .on(Errors.compositeActionNotFound, (e) => Err(e))
    .on(Errors.compositeActionReadFailed, (e) => Err(e))
    .on(Errors.compositeActionParseFailed, (e) => Err(e))
    .on(Errors.invalidCompositeAction, (e) => Err(e))
    .on(Errors.toolMissing, (e) => Err(e))
    .on(Errors.unsupportedTarget, (e) => Err(e))
    .exhaustive() as Result<boolean, Error>;
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
  action: (options: Record<string, unknown>): AsyncResult<void, Error> => {
    printBranding();
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript noPropertyAccessFromIndexSignature requires bracket notation
    const force = Boolean(options["force"]);

    return runInit(force);
  },
};

export { initCmd };
