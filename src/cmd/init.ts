import pc from "picocolors";
import { type AsyncResult, buildAsync, Err, matchErr, Ok, type Result } from "ripthrow";
import { loadManifest, saveManifest } from "../core/io/manifest";
import type { RefineryConfig } from "../core/schema";
import { LanguageRegistry, PlatformRegistry } from "../core/strategy/registry";
import type { LanguageStrategy, PlatformStrategy, StrategyContext } from "../core/strategy/types";
import { Errors } from "../errors";
import { printBranding } from "../ui";
import { logger } from "../ui/log";
import { PromptGroup, step } from "../ui/prompt";
import type { Cmd } from "./types";

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
      LanguageRegistry.all().map((l) => ({ value: l.id, label: l.name })),
    ),
    platform: step.select(
      "Select Platform",
      PlatformRegistry.all().map((p) => ({ value: p.id, label: p.name })),
    ),
  });
}

async function runStrategies(
  project: { name: string },
  langStrategy: LanguageStrategy,
  platformStrategy: PlatformStrategy,
  manifest: RefineryConfig,
): AsyncResult<void, Error> {
  const { task } = PromptGroup.spinner();

  const context: StrategyContext = {
    projectName: project.name,
    config: manifest,
    cwd: process.cwd(),
  };

  let initResult: Result<void, Error> = Ok();

  await task("Initializing project...", async () => {
    const langInit = await langStrategy.onInit(context);
    if (!langInit.ok) {
      initResult = langInit;
      return;
    }

    const platInit = await platformStrategy.onInit(context);
    if (!platInit.ok) {
      initResult = platInit;
    }
  });

  if (!initResult.ok) {
    return Err(Errors.strategyInitFailed({ strategy: "project" }));
  }

  return Ok();
}

function executeInit(project: {
  name: string;
  language: string;
  platform: string;
}): AsyncResult<void, Error> {
  return buildAsync(Promise.resolve(LanguageRegistry.get(project.language)))
    .andThen(
      (langStrategy: LanguageStrategy) =>
        buildAsync(Promise.resolve(PlatformRegistry.get(project.platform))).map(
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
      return Ok({ langStrategy, platformStrategy, manifest });
    })
    .andThen((deps) => {
      const { langStrategy, platformStrategy, manifest } = deps as {
        langStrategy: LanguageStrategy;
        platformStrategy: PlatformStrategy;
        manifest: RefineryConfig;
      };
      return runStrategies(project, langStrategy, platformStrategy, manifest);
    })
    .tap(() => {
      PromptGroup.outro(`Project ${pc.red(project.name)} initialized.`);
    })
    .andThen(() => Ok()).result;
}

async function runInit(force = false): AsyncResult<void, Error> {
  const canContinue = await checkManifest(force);
  if (!canContinue.ok) {
    return canContinue;
  }

  const project = await promptProject();

  return executeInit(project);
}

export const initCmd: Cmd = {
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

export { validateProjectName };
