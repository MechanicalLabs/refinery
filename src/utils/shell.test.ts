import { describe, expect, it } from "bun:test";
import { isOk } from "ripthrow";
import { sh } from "./shell";

/**
 * Unit tests for the shell execution utility.
 * Verifies command execution, output capturing, and exit code handling.
 */
describe("shell utility", () => {
  it("should execute a simple echo command", async () => {
    const result = await sh`echo hello`;
    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.stdout).toBe("hello");
      expect(result.value.exitCode).toBe(0);
    }
  });

  it("should capture stderr and non-zero exit code", async () => {
    // Using a command that fails
    const result = await sh`ls non-existent-file-12345`;
    expect(isOk(result)).toBe(true); // sh returns Ok even if exitCode > 0 as per implementation
    if (result.ok) {
      expect(result.value.exitCode).toBeGreaterThan(0);
      expect(result.value.stderr).not.toBe("");
    }
  });
});
