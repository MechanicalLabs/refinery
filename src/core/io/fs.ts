import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AsyncResult } from "ripthrow";
import { Err, Ok, safeAsync } from "ripthrow";

export function readFile(path: string): AsyncResult<string, Error> {
  return safeAsync(Bun.file(resolve(path)).text());
}

export async function writeFile(path: string, content: string): AsyncResult<void, Error> {
  const fullPath = resolve(path);
  const dir = dirname(fullPath);

  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    await Bun.write(fullPath, content);
    return Ok(undefined);
  } catch (e) {
    return Err(e as Error);
  }
}

export function exists(path: string): boolean {
  return existsSync(resolve(path));
}

/** @lintignore */
export function readJson<T>(path: string): AsyncResult<T, Error> {
  return safeAsync(Bun.file(resolve(path)).json() as Promise<T>);
}

/** @lintignore */
export function writeJson(path: string, data: unknown): AsyncResult<void, Error> {
  return safeAsync(
    (async (): Promise<void> => {
      const content = JSON.stringify(data, null, 2);
      const res = await writeFile(path, content);
      if (!res.ok) {
        throw res.error;
      }
    })(),
  );
}

/** @lintignore */
export function getAbsolutePath(path: string): string {
  return resolve(path);
}
