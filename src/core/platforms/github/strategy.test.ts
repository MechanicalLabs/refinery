import { describe, expect, it, mock } from "bun:test";
import { isOk, Ok } from "ripthrow";
import type { StrategyContext } from "../../strategy/types";
import { githubStrategy } from "./strategy";

describe("github strategy", () => {
  it("should have correct id and name", () => {
    expect(githubStrategy.id).toBe("github");
    expect(githubStrategy.name).toBe("GitHub");
  });

  it("should create workflow directory and file on migrate", async () => {
    const MockBytesWritten = 100;
    const mockMkdir = mock(() => Promise.resolve(Ok<void, Error>()));
    const mockWriteFile = mock(() => Promise.resolve(Ok<number, Error>(MockBytesWritten)));

    const ctx: StrategyContext = {
      projectName: "test-project",
      cwd: "/test",
      config: {
        version: 1,
        lang: "rust",
        platform: "github",
        artifacts: [],
        targets: [],
      } as unknown as StrategyContext["config"],
      sys: {
        sh: mock() as unknown as StrategyContext["sys"]["sh"],
        fs: {
          mkdir: mockMkdir,
          writeFile: mockWriteFile,
          exists: mock() as unknown as StrategyContext["sys"]["fs"]["exists"],
          readFile: mock() as unknown as StrategyContext["sys"]["fs"]["readFile"],
        },
      },
    };

    const result = await githubStrategy.migrate(ctx);
    expect(isOk(result)).toBe(true);
    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();

    // Verify path
    const calls = mockWriteFile.mock.calls as unknown[][];
    const [path] = calls[0] as [string, string];
    expect(path).toContain(".github/workflows/refinery-build.yml");
  });
});
