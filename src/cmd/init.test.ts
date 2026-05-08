import { expect, test } from "bun:test";
import { Errors } from "../errors";
import { validateProjectName } from "./init";

test("validateProjectName returns error for empty name", () => {
  expect(validateProjectName("")).toBe(Errors.projectNameRequired().message);
});

test("validateProjectName returns error for whitespace only", () => {
  expect(validateProjectName("   ")).toBe(Errors.projectNameRequired().message);
});

test("validateProjectName returns error for name with invalid chars", () => {
  expect(validateProjectName("my$project")).toBe(Errors.projectNameInvalid().message);
  expect(validateProjectName("my project")).toBe(Errors.projectNameInvalid().message);
});

test("validateProjectName returns undefined for valid name", () => {
  expect(validateProjectName("refinery-app")).toBeUndefined();
  expect(validateProjectName("my_project")).toBeUndefined();
  expect(validateProjectName("App123")).toBeUndefined();
});
