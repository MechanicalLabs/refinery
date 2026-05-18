import { type AsyncResult, AsyncResultBuilder, buildAsync, kindOf, safe } from "ripthrow";
import { parse, stringify } from "smol-toml";
import type { AppError } from "../../errors";
import { Errors } from "../../errors";
import { type RefineryConfig, RefineryConfigSchema } from "../schema";
import { exists, readFile, writeFile } from "./fs";

const FILENAME = "refinery.toml";

export function loadManifest(): AsyncResult<RefineryConfig, AppError | Error> {
  return buildAsync(exists(FILENAME))
    .andThen(() => readFile(FILENAME))
    .andThen((content) =>
      safe(() => {
        const data = parse(content);
        return RefineryConfigSchema.parse(data);
      }),
    )
    .mapErr((err): AppError | Error => {
      // biome-ignore lint/security/noSecrets: false positive on error kind string
      if (kindOf(err) === "ioFileNotFound") {
        return Errors.manifestNotFound();
      }
      return err;
    }).result;
}

export function saveManifest(config: RefineryConfig): AsyncResult<number, Error> {
  return AsyncResultBuilder.ok<RefineryConfig, Error>(config)
    .andThen((validated) => safe(() => RefineryConfigSchema.parse(validated)))
    .mapErr((e): Error => e as Error)
    .map((validated) => stringify(validated as unknown as Record<string, unknown>))
    .andThen((content) => writeFile(FILENAME, content)).result;
}
