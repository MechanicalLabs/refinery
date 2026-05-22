import { existsSync as nodeExistsSync } from "node:fs";
import { mkdir as nodeMkdirAsync } from "node:fs/promises";
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
  return buildAsync(safeAsync(nodeMkdirAsync(path, { recursive: true })))
    .map((): void => undefined)
    .mapErr((e): Error => e).result;
}

export function exists(path: string): AsyncResult<void, Error> {
  return buildAsync(safeAsync(Bun.file(resolve(path)).exists()))
    .andThen((fileExists: boolean): AsyncResult<void, Error> => {
      if (fileExists) {
        return Promise.resolve(Ok());
      }
      return Promise.resolve(Err(Errors.ioFileNotFound({ path })));
    })
    .mapErr((e): Error => e).result;
}

export function existsSync(path: string): boolean {
  return nodeExistsSync(resolve(path));
}
