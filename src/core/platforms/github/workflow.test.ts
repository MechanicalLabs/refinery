import { describe, expect, it } from "bun:test";
import { load } from "js-yaml";
import type { RefineryConfig } from "../../schema";
import { buildWorkflowYaml } from "./workflow";

const config = {
  version: 1,
  lang: "rust",
  platform: "github",
  artifacts: [{ type: "bin", name: "app", outputName: "my-app-{os}-{arch}" }],
  targets: [
    {
      id: "linux-x64",
      for: "app",
      type: "bin",
      os: "linux",
      arch: ["x86_64"],
      packages: ["tar.gz"],
    },
    {
      id: "macos-arm",
      for: "app",
      type: "bin",
      os: "macos",
      arch: ["arm64"],
      packages: ["tar.gz"],
    },
  ],
  release: {
    strip: true,
    lto: true,
    codegenUnits: 1,
    panic: "abort",
  },
} as unknown as RefineryConfig;

describe("GitHub workflow generation basics", () => {
  it("should generate valid YAML with correct matrix size", () => {
    const yaml = buildWorkflowYaml(config);
    const parsed = load(yaml) as {
      name: string;
      jobs: { build: { strategy: { matrix: { include: unknown[] } } } };
    };

    expect(parsed.name).toBe("Refinery Build");
    expect(parsed.jobs.build.strategy.matrix.include).toHaveLength(2);
  });

  it("should resolve output names correctly in matrix", () => {
    const yaml = buildWorkflowYaml(config);
    const parsed = load(yaml) as {
      jobs: {
        build: {
          strategy: {
            matrix: {
              // biome-ignore lint/style/useNamingConvention: YAML schema
              include: { output_name: string }[];
            };
          };
        };
      };
    };
    const matrix = parsed.jobs.build.strategy.matrix.include;

    expect(matrix[0]?.output_name).toBe("my-app-linux-x86_64");
    expect(matrix[1]?.output_name).toBe("my-app-macos-arm64");
  });
});

describe("GitHub workflow release profile", () => {
  it("should include release profile env variables if configured", () => {
    const yaml = buildWorkflowYaml(config);
    const parsed = load(yaml) as {
      jobs: {
        build: {
          steps: {
            name: string;
            env: Record<string, string>;
          }[];
        };
      };
    };
    const buildStep = parsed.jobs.build.steps.find((s) => s.name === "Build");

    // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature
    expect(buildStep?.env?.["CARGO_PROFILE_RELEASE_STRIP"]).toBe("symbols");
    // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature
    expect(buildStep?.env?.["CARGO_PROFILE_RELEASE_LTO"]).toBe("true");
    // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature
    expect(buildStep?.env?.["CARGO_PROFILE_RELEASE_CODEGEN_UNITS"]).toBe("1");
    // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature
    expect(buildStep?.env?.["CARGO_PROFILE_RELEASE_PANIC"]).toBe("abort");
  });
});
