import { expect, test } from "bun:test";
import { LanguageRegistry, PlatformRegistry } from "./registry";

test("LanguageRegistry contains rust", () => {
  const rust = LanguageRegistry.all().find((l) => l.id === "rust");
  expect(rust).toBeDefined();
  expect(rust?.name).toBe("Rust");
});

test("PlatformRegistry contains github", () => {
  const github = PlatformRegistry.all().find((p) => p.id === "github");
  expect(github).toBeDefined();
});

test("getLanguageStrategy returns correct strategy", () => {
  const result = LanguageRegistry.get("rust");
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.id).toBe("rust");
  }

  const fail = LanguageRegistry.get("non-existent");
  expect(fail.ok).toBe(false);
});

test("getPlatformStrategy returns correct strategy", () => {
  const result = PlatformRegistry.get("github");
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.id).toBe("github");
  }

  const fail = PlatformRegistry.get("non-existent");
  expect(fail.ok).toBe(false);
});
