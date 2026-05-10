import { type AsyncResult, buildAsync, safe } from "ripthrow";
import { parse, stringify } from "smol-toml";
import type { AppError } from "../../errors";
import { type RefineryConfig, RefineryConfigSchema } from "../schema";
import { exists, readFile, writeFile } from "./fs";

const FILENAME = "refinery.toml";

export function loadManifest(): AsyncResult<RefineryConfig, AppError | Error> {
  return buildAsync(exists(FILENAME))
    .andThen(() => buildAsync(readFile(FILENAME)).context("Failed to read refinery.toml").result)
    .andThen((content) =>
      safe(() => {
        const data = parse(content);
        return RefineryConfigSchema.parse(data);
      }),
    ).result;
}

export function saveManifest(config: RefineryConfig): AsyncResult<number, Error> {
  return buildAsync(Promise.resolve(safe(() => RefineryConfigSchema.parse(config))))
    .map((validated) => stringify(validated as unknown as Record<string, unknown>))
    .andThen(
      (content) =>
        buildAsync(writeFile(FILENAME, content)).context(
          "Failed to write refinery.toml",
          "Make sure the current directory is writable",
        ).result,
    ).result;
}
