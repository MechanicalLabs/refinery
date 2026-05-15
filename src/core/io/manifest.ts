import { type AsyncResult, AsyncResultBuilder, buildAsync, safe } from "ripthrow";
import { parse, stringify } from "smol-toml";
import type { AppError } from "../../errors";
import { type RefineryConfig, RefineryConfigSchema } from "../schema";
import { exists, readFile, writeFile } from "./fs";

const FILENAME = "refinery.toml";

export function loadManifest(): AsyncResult<RefineryConfig, AppError | Error> {
  return buildAsync(exists(FILENAME))
    .andThen(() => readFile(FILENAME))
    .note("Failed to read refinery.toml")
    .andThen((content) =>
      safe(() => {
        const data = parse(content);
        return RefineryConfigSchema.parse(data);
      }),
    ).result;
}

export function saveManifest(config: RefineryConfig): AsyncResult<number, Error> {
  return AsyncResultBuilder.ok<RefineryConfig, Error>(config)
    .andThen((validated) => safe(() => RefineryConfigSchema.parse(validated)))
    .note("Invalid configuration schema")
    .mapErr((e) => e as Error)
    .map((validated) => stringify(validated as unknown as Record<string, unknown>))
    .andThen((content) => writeFile(FILENAME, content))
    .note("Failed to write refinery.toml").result as AsyncResult<number, Error>;
}
