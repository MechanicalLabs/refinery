import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export async function readFile(path: string): Promise<string> {
  const file = Bun.file(resolve(path));
  return await file.text();
}

export async function writeFile(path: string, content: string): Promise<void> {
  const fullPath = resolve(path);
  const dir = dirname(fullPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  await Bun.write(fullPath, content);
}

export function exists(path: string): boolean {
  return existsSync(resolve(path));
}

export async function readJson<T>(path: string): Promise<T> {
  const file = Bun.file(resolve(path));
  return (await file.json()) as T;
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(data, null, 2));
}

export function getAbsolutePath(path: string): string {
  return resolve(path);
}
