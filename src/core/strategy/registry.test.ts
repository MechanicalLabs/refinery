import { expect, test } from "bun:test";
import {
  getLanguageStrategy,
  getPlatformStrategy,
  LanguageRegistry,
  PlatformRegistry,
} from "./registry";

test("LanguageRegistry contains rust", () => {
  const rust = LanguageRegistry.find((l) => l.id === "rust");
  expect(rust).toBeDefined();
  expect(rust?.name).toBe("Rust");
});

test("PlatformRegistry contains github", () => {
  const github = PlatformRegistry.find((p) => p.id === "github");
  expect(github).toBeDefined();
});

test("getLanguageStrategy returns correct strategy", () => {
  const result = getLanguageStrategy("rust");
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.id).toBe("rust");
  }

  const fail = getLanguageStrategy("non-existent");
  expect(fail.ok).toBe(false);
});

test("getPlatformStrategy returns correct strategy", () => {
  const result = getPlatformStrategy("github");
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.id).toBe("github");
  }

  const fail = getPlatformStrategy("non-existent");
  expect(fail.ok).toBe(false);
});
