import { type AsyncResult, context, safe } from "ripthrow";
import { parse, stringify } from "smol-toml";
import type { AppError } from "../../errors";
import { type RefineryConfig, RefineryConfigSchema } from "../schema";
import { exists, readFile, writeFile } from "./fs";

const FILENAME = "refinery.toml";

export async function loadManifest(): AsyncResult<RefineryConfig, AppError | Error> {
  const fileExists = await exists(FILENAME);

  if (!fileExists.ok) {
    return fileExists;
  }

  const fileResult = await readFile(FILENAME);

  if (!fileResult.ok) {
    return context(fileResult, "Failed to read refinery.toml");
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

  const writeResult = await writeFile(FILENAME, content);

  if (!writeResult.ok) {
    return context(
      writeResult,
      "Failed to write refinery.toml",
      "Make sure the current directory is writable",
    );
  }

  return writeResult;
}
