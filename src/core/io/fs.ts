import { mkdir as nodeMkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { type AsyncResult, buildAsync, Err, Ok, safeAsync } from "ripthrow";
import { Errors } from "../../errors";

export function readFile(path: string): AsyncResult<string, Error> {
  return safeAsync(Bun.file(resolve(path)).text());
}

export function writeFile(path: string, content: string): AsyncResult<number, Error> {
  const fullPath = resolve(path);

  return safeAsync(Bun.write(fullPath, content));
}

export function mkdir(path: string): AsyncResult<void, Error> {
  return buildAsync(safeAsync(nodeMkdir(path, { recursive: true }))).map(() => undefined).result;
}

export async function exists(path: string): AsyncResult<void, Error> {
  const fileExists = await Bun.file(resolve(path)).exists();

  if (fileExists) {
    return Ok();
  }

  return Err(Errors.ioFileNotFound());
}
