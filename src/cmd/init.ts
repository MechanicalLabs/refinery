import pc from "picocolors";
import { type AsyncResult, Err, matchErr, Ok } from "ripthrow";
import { loadManifest, saveManifest } from "../core/io/manifest";
import type { RefineryConfig } from "../core/schema";
import { type AppError, Errors } from "../errors";
import { logger } from "../ui/log";
import { PromptGroup, step } from "../ui/prompt";
import type { Cmd } from ".";

const PROJECT_REGEXP = /[^a-zA-Z0-9-_]/u;

// @ts-expect-error: Not all code paths return a value
function validateProjectName(v: string): string | undefined {
  if (!v.trim()) {
    return Errors.projectNameRequired().message;
  }
  if (PROJECT_REGEXP.test(v)) {
    return Errors.projectNameInvalid().message;
  }
}

async function runInit(): AsyncResult<void, AppError | Error> {
  const manifestResult = await loadManifest();

  if (manifestResult.ok) {
    logger.warn(pc.yellow("A refinery.toml manifest already exists."));
    return Ok(undefined);
  }

  const isFileNotFound = matchErr(manifestResult)
    .on(Errors.ioFileNotFound, () => true)
    .otherwise(() => false);

  if (!isFileNotFound) {
    return Err(manifestResult.error);
  }

  const ui = new PromptGroup("Refinery", "Setup");

  const project = await ui.run({
    name: step.text("Project Name", "refinery-app", validateProjectName),
    language: () => Promise.resolve("rust" as const),
    platform: () => Promise.resolve("github" as const),
  });

  const manifest: RefineryConfig = {
    version: 1,
    lang: project.language,
    platform: project.platform,
    artifacts: [{ type: "bin", name: project.name }],
  };

  await saveManifest(manifest);

  PromptGroup.outro(`Project ${pc.red(project.name)} initialized.`);

  return Ok(undefined);
}

export const initCmd: Cmd = {
  name: "init",
  description: "Initialize project",
  action: (): void => {
    runInit().then((result) => {
      if (!result.ok) {
        logger.error(result.error.message);
        process.exit(1);
      }
    });
  },
};

export { validateProjectName };
