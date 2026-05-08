import { type AsyncResult, safe } from "ripthrow";
import { parse, stringify } from "smol-toml";
import type { IoFileNotFound } from "../../errors/io/file-not-found";
import { type RefineryConfig, RefineryConfigSchema } from "../schema";
import { exists, readFile, writeFile } from "./fs";

const FILENAME = "refinery.toml";

export async function loadManifest(): AsyncResult<RefineryConfig, IoFileNotFound | Error> {
  const fileExists = await exists(FILENAME);

  if (!fileExists.ok) {
    return fileExists;
  }

  const fileResult = await readFile(FILENAME);

  if (!fileResult.ok) {
    return fileResult;
  }

  return safe(() => {
    const data = parse(fileResult.value);

    return RefineryConfigSchema.parse(data);
  });
}

export async function saveManifest(config: RefineryConfig): AsyncResult<number, Error> {
  const validation = safe(() => RefineryConfigSchema.parse(config));

  if (!validation.ok) {
    return validation;
  }

  const content = stringify(validation.value as unknown as Record<string, unknown>);

  return await writeFile(FILENAME, content);
}
