import { type AsyncResult, buildAsync, kindOf, Ok, type Report, safe } from "ripthrow";
import { parse, stringify } from "smol-toml";
import { type AppError, Errors } from "../../errors";
import { type RefineryConfig, RefineryConfigSchema } from "../schema";
import { exists, readFile, writeFile } from "./fs";

const FILENAME = "refinery.toml";

/**
 * Loads and validates the refinery.toml manifest.
 * Maps all internal errors (IO, Parse, Zod) to the AppError union.
 */
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
        const data = parse(content);
        return RefineryConfigSchema.parse(data);
      }),
    )
    .note("Parsing and validating refinery.toml")
    .mapErr((err): AppError | Report<Record<string, unknown>> => {
      const kind = kindOf(err);
      if (kind === "manifestNotFound" || kind === "validationError") {
        return err as unknown as AppError;
      }
      if (err && typeof err === "object" && "name" in err && err.name === "Report") {
        return err as Report<Record<string, unknown>>;
      }
      return Errors.validationError({ reason: String(err) });
    }).result;
}

export function saveManifest(config: RefineryConfig): AsyncResult<number, Error> {
  return buildAsync(Promise.resolve(Ok(config)))
    .andThen((validated) => safe(() => RefineryConfigSchema.parse(validated)))
    .mapErr((e): Error => e as Error)
    .map((validated) => stringify(validated as unknown as Record<string, unknown>))
    .andThen((content) => writeFile(FILENAME, content)).result;
}
