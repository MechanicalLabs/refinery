import path from "node:path";
import pc from "picocolors";
import { type AsyncResult, buildAsync, ResultBuilder } from "ripthrow";
import { exists, mkdir, readFile, writeFile } from "../../core/io/fs";
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

  const initialConfig = ctx.lang.getInitialConfig(path.basename(process.cwd()));
  const extra = { ...initialConfig } as Record<string, unknown>;
  extra["lang"] = undefined;
  extra["artifacts"] = undefined;
  extra["targets"] = undefined;
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined) {
      (manifest as Record<string, unknown>)[k] = v;
    }
  }

  return buildAsync(saveManifest(manifest))
    .note("Saving initial refinery.toml")
    .mapErr((e): Error => e as Error)
    .map((): InitContextWithManifest => ({ ...ctx, manifest })).result;
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
    lang: ctx.lang,
    cwd: process.cwd(),
    sys: {
      sh,
      fs: { exists, mkdir, readFile, writeFile },
    },
  };

  return buildAsync(
    task(
      "Initializing project...",
      async (): AsyncResult<void, Error> =>
        buildAsync(ctx.lang.onInit(strategyCtx))
          .note(`Running ${ctx.lang.name} initialization`)
          .mapErr((e): Error => e as Error)
          .andThen((): AsyncResult<void, Error> => ctx.plat.onInit(strategyCtx))
          .note(`Running ${ctx.plat.name} initialization`)
          .mapErr((e): Error => e as Error).result,
    ),
  )
    .note("Executing initialization hooks")
    .mapErr((e): Error => e as Error)
    .map((): InitContextWithManifest => ctx)
    .mapErr((): Error => Errors.strategyInitFailed({ strategy: "project" })).result;
}

/**
 * Entry point for the initialization pipeline.
 */
export function executeInitPipeline(answers: ProjectAnswers): AsyncResult<void, Error> {
  const projectName = path.basename(process.cwd());

  return buildAsync(resolveStrategies(answers))
    .note("Resolving project strategies")
    .mapErr((e): Error => e as Error)
    .andThen(createInitialManifest)
    .note("Preparing project manifest")
    .mapErr((e): Error => e as Error)
    .andThen(runStrategyHooks)
    .note("Configuring project environment")
    .mapErr((e): Error => e as Error)
    .tap((): void => {
      PromptGroup.outro(`Project ${pc.red(projectName)} initialized.`);
    })
    .map((): void => undefined).result;
}
