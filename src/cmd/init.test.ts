import { expect, test } from "bun:test";
import { ProjectNameInvalidError, ProjectNameRequiredError } from "../error";
import { validateProjectName } from "./init";

test("validateProjectName returns error for empty name", () => {
  expect(validateProjectName("")).toBe(new ProjectNameRequiredError().message);
});

test("validateProjectName returns error for whitespace only", () => {
  expect(validateProjectName("   ")).toBe(new ProjectNameRequiredError().message);
});

test("validateProjectName returns error for name with invalid chars", () => {
  expect(validateProjectName("my$project")).toBe(new ProjectNameInvalidError().message);
  expect(validateProjectName("my project")).toBe(new ProjectNameInvalidError().message);
});

test("validateProjectName returns undefined for valid name", () => {
  expect(validateProjectName("refinery-app")).toBeUndefined();
  expect(validateProjectName("my_project")).toBeUndefined();
  expect(validateProjectName("App123")).toBeUndefined();
});
