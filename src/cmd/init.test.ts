import { expect, test } from "bun:test";
import { validateName } from "../utils/naming";

test("validateName returns error for empty name", () => {
  const res = validateName("");
  expect(res.ok).toBe(false);
  if (!res.ok) {
    expect(res.error).toBe("Name is required");
  }
});

test("validateName returns error for whitespace only", () => {
  const res = validateName("   ");
  expect(res.ok).toBe(false);
  if (!res.ok) {
    expect(res.error).toBe("Name is required");
  }
});

test("validateName returns error for name with invalid chars", () => {
  const errorMsg = "Only lowercase letters, numbers, and hyphens are allowed";
  const invalidNames = ["my$project", "my project", "App123", "my_project"];

  for (const name of invalidNames) {
    const res = validateName(name);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe(errorMsg);
    }
  }
});

test("validateName returns ok for valid name", () => {
  expect(validateName("refinery-app").ok).toBe(true);
  expect(validateName("my-project-123").ok).toBe(true);
  expect(validateName("lib-x").ok).toBe(true);
});
