import { resolve } from "node:path";
import { type AsyncResult, Err, Ok, safeAsync } from "ripthrow";
import { Errors } from "../../errors";

export function readFile(path: string): AsyncResult<string, Error> {
  return safeAsync(Bun.file(resolve(path)).text());
}

export function writeFile(path: string, content: string): AsyncResult<number, Error> {
  const fullPath = resolve(path);

  return safeAsync(Bun.write(fullPath, content));
}

export async function exists(path: string): AsyncResult<void, Error> {
  const fileExists = await Bun.file(resolve(path)).exists();

  if (fileExists) {
    return Ok();
  }

  return Err(Errors.ioFileNotFound());
}

// export function readJson<T>(path: string): AsyncResultBuilder<T, Error> {
//   return AsyncResultBuilder.safeAsync(Bun.file(resolve(path)).json() as Promise<T>);
// }

// export async function writeJson(path: string, data: unknown): AsyncResult<number, Error> {
//   const contentResult = safe(() => JSON.stringify(data, null, 2));

//   if (!contentResult.ok) {
//     return Err(contentResult.error as Error);
//   }

//   return await writeFile(path, contentResult.value);
// }

// export function getAbsolutePath(path: string): string {
//   return resolve(path);
// }
