import { describe, expect, it } from "bun:test";
import { parseCargoToml } from "./cargo";

describe("cargo utility", () => {
  it("should parse a simple Cargo.toml", () => {
    const toml = `
      [package]
      name = "my-crate"
      version = "0.1.0"
    `;
    const info = parseCargoToml(toml);
    expect(info.packageName).toBe("my-crate");
    expect(info.binNames).toEqual([]);
    expect(info.libNames).toEqual([]);
  });

  it("should parse multiple binaries", () => {
    const toml = `
      [package]
      name = "multi-bin"

      [[bin]]
      name = "server"
      path = "src/main.rs"

      [[bin]]
      name = "cli"
      path = "src/cli.rs"
    `;
    const info = parseCargoToml(toml);
    expect(info.packageName).toBe("multi-bin");
    expect(info.binNames).toEqual(["server", "cli"]);
  });

  it("should parse library name", () => {
    const toml = `
      [package]
      name = "my-lib"

      [lib]
      name = "core"
      path = "src/lib.rs"
    `;
    const info = parseCargoToml(toml);
    expect(info.libNames).toEqual(["core"]);
  });
});
