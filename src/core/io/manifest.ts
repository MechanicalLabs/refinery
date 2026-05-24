import { type AsyncResult, buildAsync, kindOf, Ok, type Report, safe } from "ripthrow";
import { parse, stringify } from "smol-toml";
import { ZodError, type z } from "zod";
import { type AppError, Errors } from "../../errors";
import { BaseConfigSchema, type RefineryConfig } from "../schema";
import { LanguageRegistry } from "../strategy/registry";
import { exists, readFile, writeFile } from "./fs";

const FILENAME = "refinery.toml";

function validateWithLang(data: Record<string, unknown>, config: RefineryConfig): RefineryConfig {
  const langResult = LanguageRegistry.get(config.lang);
  if (!langResult.ok) {
    return config;
  }
  const lang = langResult.value;
  const fullSchema = lang.configSchema;
  const result = fullSchema.parse(data) as Record<string, unknown>;
  return { ...config, ...result } as RefineryConfig;
}

function deepKindOf(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  if ("kind" in err) return (err as { kind: string }).kind;
  if (err instanceof Error && err.cause) return deepKindOf(err.cause);
  return undefined;
}

function findZodError(err: unknown): ZodError | undefined {
  if (err instanceof ZodError) return err;
  if (err instanceof Error && err.cause) return findZodError(err.cause);
  return undefined;
}

function flattenZodIssues(issues: z.ZodIssue[]): string[] {
  const lines: string[] = [];
  for (const issue of issues) {
    if ("errors" in issue && Array.isArray(issue.errors)) {
      lines.push(...flattenZodIssues(issue.errors.flat() as z.ZodIssue[]));
    } else {
      lines.push(`${issue.path.length > 0 ? issue.path.join(".") + ": " : ""}${issue.message}`);
    }
  }
  return [...new Set(lines)];
}

export function loadManifest(): AsyncResult<
  RefineryConfig,
  AppError | Report<Record<string, unknown>>
> {
  return buildAsync(exists(FILENAME))
    .note("Checking for refinery.toml existence")
    .mapErr((err): AppError | Report<Record<string, unknown>> => {
      if (kindOf(err) === "ioFileNotFound") {
        return Errors.manifestNotFound();
      }
      return Errors.validationError({ reason: String(err) });
    })
    .andThen(
      () =>
        buildAsync(readFile(FILENAME)).mapErr(
          (err): AppError => Errors.validationError({ reason: String(err) }),
        ).result,
    )
    .note("Reading refinery.toml content")
    .andThen((content: string) =>
      safe(() => {
        const data = parse(content) as Record<string, unknown>;
        const baseConfig = BaseConfigSchema.parse(data);
        return validateWithLang(data, baseConfig);
      }),
    )
    .note("Parsing and validating refinery.toml")
    .mapErr((err): AppError | Report<Record<string, unknown>> => {
      const kind = deepKindOf(err);
      if (kind === "manifestNotFound") {
        return Errors.manifestNotFound();
      }
      if (kind === "validationError") {
        return Errors.validationError({ reason: String(err) });
      }
      if (err && typeof err === "object" && "name" in err && err.name === "Report") {
        const zodErr = findZodError(err);
        if (zodErr) {
          const lines = flattenZodIssues(zodErr.issues);
          return Errors.validationError({ reason: lines.join("\n") });
        }
        return err as Report<Record<string, unknown>>;
      }
      return Errors.validationError({ reason: String(err) });
    }).result;
}

export function saveManifest(config: RefineryConfig): AsyncResult<number, Error> {
  return buildAsync(Promise.resolve(Ok(config)))
    .andThen((validated) => safe(() => BaseConfigSchema.parse(validated)))
    .mapErr((e): Error => e as Error)
    .map((validated) => stringify(validated as unknown as Record<string, unknown>))
    .andThen((content) => writeFile(FILENAME, content)).result;
}
