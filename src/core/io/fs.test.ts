import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { exists as nodeExists, mkdir as nodeMkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { isErr, isOk } from "ripthrow";
import { exists, mkdir, readFile, writeFile } from "./fs";

describe("fs core io", () => {
  const testDir = join(process.cwd(), "temp-test-fs");

  beforeAll(async () => {
    if (await nodeExists(testDir)) {
      await rm(testDir, { recursive: true });
    }
    await nodeMkdir(testDir);
  });

  afterAll(async () => {
    if (await nodeExists(testDir)) {
      await rm(testDir, { recursive: true });
    }
  });

  it("should write and read a file", async () => {
    const filePath = join(testDir, "test.txt");
    const content = "hello world";

    const writeResult = await writeFile(filePath, content);
    expect(isOk(writeResult)).toBe(true);

    const readResult = await readFile(filePath);
    expect(isOk(readResult)).toBe(true);
    if (readResult.ok) {
      expect(readResult.value).toBe(content);
    }
  });

  it("should check if a file exists", async () => {
    const filePath = join(testDir, "exists.txt");
    await writeFile(filePath, "content");

    const existsResult = await exists(filePath);
    expect(isOk(existsResult)).toBe(true);

    const nonExistentPath = join(testDir, "not-here.txt");
    const notExistsResult = await exists(nonExistentPath);
    expect(isErr(notExistsResult)).toBe(true);
  });

  it("should create a directory recursively", async () => {
    const nestedDir = join(testDir, "a/b/c");
    const mkdirResult = await mkdir(nestedDir);
    expect(isOk(mkdirResult)).toBe(true);

    const dirExists = await nodeExists(nestedDir);
    expect(dirExists).toBe(true);
  });
});
