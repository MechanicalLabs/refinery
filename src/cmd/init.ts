import pc from "picocolors";
import { type AsyncResult, AsyncResultBuilder, buildAsync, Err, matchErr, Ok } from "ripthrow";
import { loadManifest, saveManifest } from "../core/io/manifest";
import type { RefineryConfig } from "../core/schema";
import {
  getLanguageStrategy,
  getPlatformStrategy,
  LanguageRegistry,
  PlatformRegistry,
} from "../core/strategy/registry";
import type { LanguageStrategy, PlatformStrategy } from "../core/strategy/types";
import { Errors } from "../errors";
import { printBranding } from "../ui";
import { logger } from "../ui/log";
import { PromptGroup, step } from "../ui/prompt";
import type { Cmd } from ".";

const PROJECT_REGEXP = /[^a-zA-Z0-9-_]/u;

function validateProjectName(v: string): string | undefined {
  let error: string | undefined;

  if (!v.trim()) {
    error = Errors.projectNameRequired().message;
  } else if (PROJECT_REGEXP.test(v)) {
    error = Errors.projectNameInvalid().message;
  }

  return error;
}

async function checkManifest(force: boolean): AsyncResult<boolean, Error> {
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

async function promptProject(): Promise<{ name: string; language: string; platform: string }> {
  const ui = new PromptGroup("Refinery", "Setup");

  return await ui.run({
    name: step.text("Project Name", "refinery-app", validateProjectName),
    language: step.select(
      "Select Language",
      LanguageRegistry.map((l) => ({ value: l.id, label: l.name })),
    ),
    platform: step.select(
      "Select Platform",
      PlatformRegistry.map((p) => ({ value: p.id, label: p.name })),
    ),
  });
}

async function runInit(force = false): AsyncResult<void, Error> {
  const canContinue = await checkManifest(force);
  if (!canContinue.ok) {
    return canContinue;
  }

  const project = await promptProject();

  return buildAsync(Promise.resolve(getLanguageStrategy(project.language)))
    .andThen(
      (langStrategy: LanguageStrategy) =>
        buildAsync(Promise.resolve(getPlatformStrategy(project.platform))).map(
          (platformStrategy: PlatformStrategy) => ({
            langStrategy,
            platformStrategy,
          }),
        ).result,
    )
    .andThen(async (deps) => {
      const { langStrategy, platformStrategy } = deps as {
        langStrategy: LanguageStrategy;
        platformStrategy: PlatformStrategy;
      };
      const manifest: RefineryConfig = {
        version: 1,
        platform: project.platform as "github",
        ...langStrategy.getInitialConfig(project.name),
      } as RefineryConfig;

      const result = await saveManifest(manifest);
      if (!result.ok) {
        return result;
      }
      return Ok({ langStrategy, platformStrategy });
    })
    .andThen((deps) => {
      const { langStrategy, platformStrategy } = deps as {
        langStrategy: LanguageStrategy;
        platformStrategy: PlatformStrategy;
      };
      const { task } = PromptGroup.spinner();

      return AsyncResultBuilder.safeAsync(
        task("Initializing project...", async () => {
          await langStrategy.onInit(project.name);
          await platformStrategy.onInit(project.name);
        }),
      ).mapErr((err) => {
        if (err instanceof Error) {
          return err;
        }
        return new Error(String(err));
      }).result;
    })
    .tap(() => {
      PromptGroup.outro(`Project ${pc.red(project.name)} initialized.`);
    }).result;
}

export const initCmd: Cmd = {
  name: "init",
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

export { validateProjectName };
