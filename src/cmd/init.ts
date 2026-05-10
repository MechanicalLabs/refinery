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

// --- TYPES & CONSTANTS ---

const PROJECT_REGEXP = /[^a-zA-Z0-9-_]/u;

interface ProjectAnswers {
  name: string;
  language: string;
  platform: string;
}

interface InitContext {
  answers: ProjectAnswers;
  lang: LanguageStrategy;
  plat: PlatformStrategy;
  manifest?: RefineryConfig;
}

// --- MAIN ORCHESTRATOR ---

async function runInit(force = false): AsyncResult<void, Error> {
  const canContinue = await checkPreconditions(force);
  if (!canContinue.ok) {
    return canContinue;
  }

  const answers = await promptUser();

  return executeInitPipeline(answers);
}

// --- PIPELINE PHASES ---

function executeInitPipeline(answers: ProjectAnswers): AsyncResult<void, Error> {
  return buildAsync(resolveStrategies(answers))
    .andThen((ctx) => createInitialManifest(ctx))
    .andThen((ctx) => runStrategyHooks(ctx))
    .tap((ctx) => {
      PromptGroup.outro(`Project ${pc.red(ctx.answers.name)} initialized.`);
    })
    .andThen(() => Ok()).result;
}

// --- IMPLEMENTATION DETAILS ---

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

async function promptUser(): Promise<ProjectAnswers> {
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

function resolveStrategies(answers: ProjectAnswers): AsyncResult<InitContext, Error> {
  return buildAsync(Promise.resolve(LanguageRegistry.get(answers.language))).andThen(
    (lang) =>
      buildAsync(Promise.resolve(PlatformRegistry.get(answers.platform))).map((plat) => ({
        answers,
        lang,
        plat,
      })).result,
  ).result;
}

async function createInitialManifest(ctx: InitContext): AsyncResult<InitContext, Error> {
  const manifest: RefineryConfig = {
    version: 1,
    platform: ctx.answers.platform as "github",
    ...ctx.lang.getInitialConfig(ctx.answers.name),
  } as RefineryConfig;

  const result = await saveManifest(manifest);
  if (!result.ok) {
    return result;
  }

  return Ok({ ...ctx, manifest });
}

async function runStrategyHooks(ctx: InitContext): AsyncResult<InitContext, Error> {
  const { task } = PromptGroup.spinner();
  const strategyCtx: StrategyContext = {
    projectName: ctx.answers.name,
    config: ctx.manifest as RefineryConfig,
    cwd: process.cwd(),
  };

  let initResult: Result<void, Error> = Ok();

  await task("Initializing project...", async () => {
    const langInit = await ctx.lang.onInit(strategyCtx);
    if (!langInit.ok) {
      initResult = langInit;
      return;
    }

    const platInit = await ctx.plat.onInit(strategyCtx);
    if (!platInit.ok) {
      initResult = platInit;
    }
  });

  if (!initResult.ok) {
    return Err(Errors.strategyInitFailed({ strategy: "project" }));
  }

  return Ok(ctx);
}

function validateProjectName(v: string): string | undefined {
  let error: string | undefined;

  if (!v.trim()) {
    error = Errors.projectNameRequired().message;
  } else if (PROJECT_REGEXP.test(v)) {
    error = Errors.projectNameInvalid().message;
  }

  return error;
}

// --- EXPORTS ---

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

export { initCmd, validateProjectName };
