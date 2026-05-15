import { describe, expect, it } from "bun:test";
import { rustStrategy } from "./strategy";

describe("rust strategy", () => {
  it("should have correct id and name", () => {
    expect(rustStrategy.id).toBe("rust");
    expect(rustStrategy.name).toBe("Rust");
  });

  it("should generate correct initial config", () => {
    const config = rustStrategy.getInitialConfig("test-project");
    expect(config.lang).toBe("rust");
    expect(config.artifacts).toHaveLength(1);
    expect(config.artifacts?.[0]?.name).toBe("test-project");
    expect(config.artifacts?.[0]?.type).toBe("bin");
  });
});
