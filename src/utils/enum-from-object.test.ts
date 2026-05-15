import { describe, expect, it } from "bun:test";
import { enumFromObject } from "./enum-from-object";

describe("enum-from-object utility", () => {
  it("should create a ZodEnum from object values", () => {
    const obj = {
      keyA: "value1" as const,
      keyB: "value2" as const,
      keyC: "value3" as const,
    };
    const result = enumFromObject(obj);
    expect(result.options).toEqual(["value1", "value2", "value3"]);
  });

  it("should return a ZodEnum with empty options for an empty object", () => {
    const obj = {};
    const result = enumFromObject(obj as Record<string, string>);
    expect(result.options).toEqual([]);
  });
});
