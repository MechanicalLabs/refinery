import path from "node:path";
import pc from "picocolors";
import { type AsyncResult, buildAsync, Ok, type Result, ResultBuilder } from "ripthrow";
import { exists, readFile, writeFile } from "../../core/io/fs";
import { saveManifest } from "../../core/io/manifest";
import type { RefineryConfig } from "../../core/schema";
import { LanguageRegistry, PlatformRegistry } from "../../core/strategy/registry";
import type {
  LanguageStrategy,
  PlatformStrategy,
  StrategyContext,
} from "../../core/strategy/types";
import { Errors } from "../../errors";
import { PromptGroup } from "../../ui/prompt";
import { sh } from "../../utils/shell";
import type { ProjectAnswers } from "./ui";

interface InitContext {
  answers: ProjectAnswers;
  lang: LanguageStrategy;
  plat: PlatformStrategy;
}

interface InitContextWithManifest extends InitContext {
  manifest: RefineryConfig;
}

/**
 * Resolves language and platform strategies using ResultBuilder.all
 * for clean, type-safe combination of multiple results.
 */
function resolveStrategies(answers: ProjectAnswers): AsyncResult<InitContext, Error> {
  const { result } = ResultBuilder.all([
    LanguageRegistry.get(answers.language),
    PlatformRegistry.get(answers.platform),
  ]).map(
    ([lang, plat]): InitContext => ({
      answers,
      lang,
      plat,
    }),
  );

  return Promise.resolve(result);
}

/**
 * Persists the manifest and transitions to InitContextWithManifest.
 */
function createInitialManifest(ctx: InitContext): AsyncResult<InitContextWithManifest, Error> {
  const manifest: RefineryConfig = {
    version: 1,
    platform: ctx.answers.platform as "github",
    lang: ctx.answers.language,
    artifacts: ctx.answers.artifacts,
    targets: ctx.answers.targets,
  } as RefineryConfig;

  return buildAsync(saveManifest(manifest)).map(
    (): InitContextWithManifest => ({ ...ctx, manifest }),
  ).result;
}

/**
 * Executes strategy initialization hooks within a spinner task.
 * Strategies are run sequentially via AsyncResult chaining.
 */
function runStrategyHooks(
  ctx: InitContextWithManifest,
): AsyncResult<InitContextWithManifest, Error> {
  const { task } = PromptGroup.spinner();
  const projectName = path.basename(process.cwd());
  const strategyCtx: StrategyContext = {
    projectName,
    config: ctx.manifest,
    cwd: process.cwd(),
    sys: {
      sh,
      fs: { exists, readFile, writeFile },
    },
  };

  return buildAsync(
    task(
      "Initializing project...",
      async (): AsyncResult<void, Error> =>
        buildAsync(ctx.lang.onInit(strategyCtx)).andThen(
          (): AsyncResult<void, Error> => ctx.plat.onInit(strategyCtx),
        ).result,
    ),
  )
    .map((): InitContextWithManifest => ctx)
    .mapErr((): Error => Errors.strategyInitFailed({ strategy: "project" })).result;
}

/**
 * Entry point for the initialization pipeline.
 */
export function executeInitPipeline(answers: ProjectAnswers): AsyncResult<void, Error> {
  const projectName = path.basename(process.cwd());

  return buildAsync(resolveStrategies(answers))
    .andThen(createInitialManifest)
    .andThen(runStrategyHooks)
    .tap((): void => {
      PromptGroup.outro(`Project ${pc.red(projectName)} initialized.`);
    })
    .andThen((): Result<void, Error> => Ok()).result;
}
