import { describe, expect, it } from "bun:test";
import { isErr, isOk } from "ripthrow";
import { slugify, validateName } from "./naming";

describe("naming utility", () => {
  describe("validateName", () => {
    it("should accept valid kebab-case names", () => {
      expect(isOk(validateName("my-project"))).toBe(true);
      expect(isOk(validateName("project123"))).toBe(true);
      expect(isOk(validateName("a-b-c"))).toBe(true);
    });

    it("should reject empty or whitespace names", () => {
      expect(isErr(validateName(""))).toBe(true);
      expect(isErr(validateName("   "))).toBe(true);
    });

    it("should reject names with uppercase letters", () => {
      expect(isErr(validateName("MyProject"))).toBe(true);
    });

    it("should reject names with special characters", () => {
      expect(isErr(validateName("my_project"))).toBe(true);
      expect(isErr(validateName("project!"))).toBe(true);
      expect(isErr(validateName("project.js"))).toBe(true);
    });
  });

  describe("slugify", () => {
    it("should convert to lowercase and replace non-alphanumeric with hyphens", () => {
      expect(slugify("My Project")).toBe("my-project");
      expect(slugify("Project!@#")).toBe("project");
      expect(slugify("some_mixed_Case")).toBe("some-mixed-case");
    });

    it("should collapse multiple hyphens", () => {
      expect(slugify("my---project")).toBe("my-project");
      expect(slugify("---start-and-end---")).toBe("start-and-end");
    });

    it("should handle numbers", () => {
      expect(slugify("Project 123")).toBe("project-123");
    });
  });
});
