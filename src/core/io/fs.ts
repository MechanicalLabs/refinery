import { resolve } from "node:path";
import type { AsyncResult } from "ripthrow";
import { Err, safe, safeAsync } from "ripthrow";

export function readFile(path: string): AsyncResult<string, Error> {
  return safeAsync(Bun.file(resolve(path)).text());
}

export function writeFile(path: string, content: string): AsyncResult<number, Error> {
  const fullPath = resolve(path);

  return safeAsync(Bun.write(fullPath, content));
}

export function exists(path: string): Promise<boolean> {
  return Bun.file(resolve(path)).exists();
}

/** @lintignore */
export function readJson<T>(path: string): AsyncResult<T, Error> {
  return safeAsync(Bun.file(resolve(path)).json() as Promise<T>);
}

/** @lintignore */
export async function writeJson(path: string, data: unknown): AsyncResult<number, Error> {
  const contentResult = safe(() => JSON.stringify(data, null, 2));

  if (!contentResult.ok) {
    return Err(contentResult.error as Error);
  }

  return await writeFile(path, contentResult.value);
}

/** @lintignore */
export function getAbsolutePath(path: string): string {
  return resolve(path);
}
