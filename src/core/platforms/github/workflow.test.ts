// biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: it's a test
// biome-ignore-all lint/style/useNamingConvention: YAML schema
// biome-ignore-all lint/complexity/useLiteralKeys: test assertions with bracket notation
// biome-ignore-all lint/nursery/noExcessiveLinesPerFile: test suite contains all GHA tests
import { describe, expect, it } from "bun:test";
import { load } from "js-yaml";
import { Ok } from "ripthrow";
import type { ShellOutput } from "../../../utils/shell";
import { rustStrategy } from "../../lang/rust/strategy";
import type { RefineryConfig } from "../../schema";
import type { StrategyContext } from "../../strategy/types";
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
const createCtx = (c: RefineryConfig): StrategyContext => ({
  projectName: "test-app",
  config: c,
  lang: rustStrategy,
  cwd: "/",
  sys: {
    sh: async () => Ok<ShellOutput, Error>({ stdout: "", stderr: "", exitCode: 0 }),
    fs: {
      exists: async () => Ok<void, Error>(),
      readFile: async () => Ok<string, Error>(""),
      writeFile: async () => Ok<number, Error>(0),
      mkdir: async () => Ok<void, Error>(),
    },
  },
});

describe("GitHub workflow generation basics", () => {
  it("should generate valid YAML with correct matrix size", () => {
    const yamlResult = buildWorkflowYaml(createCtx(config));
    expect(yamlResult.ok).toBe(true);
    const yaml = yamlResult.value;
    const parsed = load(yaml) as {
      name: string;
      jobs: { build: { strategy: { matrix: { include: unknown[] } } } };
    };

    expect(parsed.name).toBe("Refinery Build");
    expect(parsed.jobs.build.strategy.matrix.include).toHaveLength(2);
  });

  it("should resolve output names correctly in matrix", () => {
    const yamlResult = buildWorkflowYaml(createCtx(config));
    expect(yamlResult.ok).toBe(true);
    const yaml = yamlResult.value;
    const parsed = load(yaml) as {
      jobs: {
        build: {
          strategy: {
            matrix: {
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
    const yamlResult = buildWorkflowYaml(createCtx(config));
    expect(yamlResult.ok).toBe(true);
    const yaml = yamlResult.value;
    const parsed = load(yaml) as {
      jobs: {
        build: {
          env: Record<string, string>;
        };
      };
    };
    const { env } = parsed.jobs.build;

    expect(env?.["CARGO_PROFILE_RELEASE_STRIP"]).toBe("symbols");
    expect(env?.["CARGO_PROFILE_RELEASE_LTO"]).toBe("true");
    expect(env?.["CARGO_PROFILE_RELEASE_CODEGEN_UNITS"]).toBe("1");
    expect(env?.["CARGO_PROFILE_RELEASE_PANIC"]).toBe("abort");
  });
});

describe("GitHub workflow packaging", () => {
  const pkgConfig = {
    version: 1,
    lang: "rust",
    platform: "github",
    artifacts: [{ type: "bin", name: "cli" }],
    targets: [
      {
        id: "linux-all",
        for: "cli",
        type: "bin",
        os: "linux",
        arch: ["x86_64"],
        packages: ["tar.gz", "deb", "rpm"],
      },
      {
        id: "win-msi",
        for: "cli",
        type: "bin",
        os: "windows",
        arch: ["x86_64"],
        packages: ["msi"],
      },
      {
        id: "macos-default",
        for: "cli",
        type: "bin",
        os: "macos",
        arch: ["arm64"],
        packages: ["tar.gz"],
        includeInPackage: ["LICENSE", "README.md"],
      },
    ],
  } as unknown as RefineryConfig;

  it("should set package flags and include_files in matrix entries", () => {
    const yamlResult = buildWorkflowYaml(createCtx(pkgConfig));
    expect(yamlResult.ok).toBe(true);
    const yaml = yamlResult.value;
    const parsed = load(yaml) as {
      jobs: {
        build: {
          strategy: {
            matrix: {
              include: {
                os: string;
                has_deb: boolean;
                has_rpm: boolean;
                has_msi: boolean;
                has_archive: boolean;
                packages: string[];
                include_files: string[];
                apt_packages: string[];
              }[];
            };
          };
        };
      };
    };
    const matrix = parsed.jobs.build.strategy.matrix.include;

    const linuxEntry = matrix.find((e) => e.packages?.includes("deb"));
    expect(linuxEntry?.has_deb).toBe(true);
    expect(linuxEntry?.has_rpm).toBe(true);
    expect(linuxEntry?.has_archive).toBe(true);
    expect(linuxEntry?.has_msi).toBe(false);
    expect(linuxEntry?.apt_packages).toContain("rpm");

    const winEntry = matrix.find((e) => e.packages?.includes("msi"));
    expect(winEntry?.has_msi).toBe(true);
    expect(winEntry?.has_deb).toBe(false);
    expect(winEntry?.has_rpm).toBe(false);
    expect(winEntry?.has_archive).toBe(false);
    expect(winEntry?.apt_packages).toEqual([]);

    const macEntry = matrix.find((e) => e.os === "macos");
    expect(macEntry?.has_deb).toBe(false);
    expect(macEntry?.has_rpm).toBe(false);
    expect(macEntry?.has_msi).toBe(false);
    expect(macEntry?.has_archive).toBe(true);
    expect(macEntry?.include_files).toEqual(["LICENSE", "README.md"]);
    expect(macEntry?.apt_packages).toEqual([]);
  });

  it("should include packaging install and build steps for deb/rpm/msi", () => {
    const yamlResult = buildWorkflowYaml(createCtx(pkgConfig));
    expect(yamlResult.ok).toBe(true);
    const yaml = yamlResult.value;
    const parsed = load(yaml) as {
      jobs: {
        build: {
          steps: { name: string; if?: string; run?: string; uses?: string }[];
        };
      };
    };
    const { steps } = parsed.jobs.build;

    expect(steps.some((s) => s.name === "Configure Linker and System Dependencies")).toBe(true);
    expect(steps.some((s) => s.name === "Install cargo-deb")).toBe(true);
    expect(steps.some((s) => s.name === "Build .deb package")).toBe(true);
    expect(steps.some((s) => s.name === "Install cargo-generate-rpm")).toBe(true);
    expect(steps.some((s) => s.name === "Build .rpm package")).toBe(true);
    expect(steps.some((s) => s.name === "Install cargo-wix")).toBe(true);
    expect(steps.some((s) => s.name === "Build .msi package")).toBe(true);
    expect(steps.some((s) => s.name === "Copy Extra Files")).toBe(true);
    // Checksums should NOT be in the build job anymore
    expect(steps.some((s) => s.name === "Generate Checksums")).toBe(false);
  });

  it("should generate conditional steps with correct if expressions", () => {
    const yamlResult = buildWorkflowYaml(createCtx(pkgConfig));
    expect(yamlResult.ok).toBe(true);
    const yaml = yamlResult.value;
    const parsed = load(yaml) as {
      jobs: {
        build: {
          steps: { name: string; if?: string }[];
        };
      };
    };
    const { steps } = parsed.jobs.build;

    const debStep = steps.find((s) => s.name === "Build .deb package");
    expect(debStep?.if).toBe("${{ matrix.has_deb }}");

    const rpmStep = steps.find((s) => s.name === "Build .rpm package");
    expect(rpmStep?.if).toBe("${{ matrix.has_rpm }}");

    const msiStep = steps.find((s) => s.name === "Build .msi package");
    expect(msiStep?.if).toBe("${{ matrix.has_msi }}");
  });

  it("should upload _packages directory as artifact", () => {
    const yamlResult = buildWorkflowYaml(createCtx(pkgConfig));
    expect(yamlResult.ok).toBe(true);
    const yaml = yamlResult.value;
    const parsed = load(yaml) as {
      jobs: {
        build: {
          steps: { name: string; with?: { path?: string } }[];
        };
      };
    };
    const uploadStep = parsed.jobs.build.steps.find((s) => s.name === "Upload Artifact");
    expect(uploadStep?.with?.path).toBe("_packages/");
  });
});

describe("GitHub workflow hooks", () => {
  const hooksConfig: RefineryConfig = {
    version: 1,
    platform: "github",
    lang: "rust",
    toolchain: "stable",
    artifacts: [
      {
        type: "bin",
        name: "test-app",
      },
    ],
    targets: [
      {
        id: "linux-target",
        for: "test-app",
        os: "linux",
        arch: ["x86_64"],
        abi: "gnu",
        type: "bin",
      },
      {
        id: "win-target",
        for: "test-app",
        os: "windows",
        arch: ["x86_64"],
        abi: "msvc",
        type: "bin",
      },
    ],
    pre_build: [
      {
        type: "builtin",
        builtin: "checkout",
      },
      {
        type: "composite",
        name: "Custom Linter",
        action: "run-linter",
        targets: ["linux-target"],
      },
    ],
    post_build: [
      {
        type: "builtin",
        builtin: "package",
      },
      {
        type: "composite",
        name: "Post Notify",
        action: "slack-notify",
        targets: "once",
      },
    ],
    publish: [
      {
        type: "builtin",
        builtin: "download_artifact",
      },
      {
        type: "composite",
        name: "Publish Metrics",
        action: "metrics",
      },
    ],
  };

  it("should generate dynamic workflow with custom pre_build, post_build, and publish hooks", () => {
    const yamlResult = buildWorkflowYaml(createCtx(hooksConfig as unknown as RefineryConfig));
    expect(yamlResult.ok).toBe(true);
    const yaml = yamlResult.value;
    const parsed = load(yaml) as {
      jobs: {
        build: {
          steps: { name: string; if?: string; uses?: string }[];
        };
        release?: {
          steps: { name: string; uses?: string }[];
        };
      };
    };

    const buildSteps = parsed.jobs.build.steps;
    const releaseSteps = parsed.jobs.release?.steps;

    expect(buildSteps.some((s) => s.name === "Checkout")).toBe(true);

    const linterStep = buildSteps.find((s) => s.name === "Custom Linter");
    expect(linterStep).toBeDefined();
    expect(linterStep?.uses).toBe("./.github/actions/run-linter");
    expect(linterStep?.if).toBe("matrix.target_triple == 'x86_64-unknown-linux-gnu'");

    const notifyStep = buildSteps.find((s) => s.name === "Post Notify");
    expect(notifyStep).toBeDefined();
    expect(notifyStep?.uses).toBe("./.github/actions/slack-notify");
    expect(notifyStep?.if).toBe("matrix.target_triple == 'x86_64-unknown-linux-gnu'");

    expect(releaseSteps).toBeDefined();
    expect(releaseSteps?.some((s) => s.name === "Download Artifacts")).toBe(true);
    expect(releaseSteps?.some((s) => s.name === "Publish Metrics")).toBe(true);
  });
});

describe("GitHub workflow library and WASM support", () => {
  const libConfig = {
    version: 1,
    lang: "rust",
    platform: "github",
    artifacts: [
      { type: "lib", name: "my_lib", headers: true },
      { type: "lib", name: "wasm_lib", headers: false },
    ],
    targets: [
      {
        id: "linux-lib",
        for: "my_lib",
        type: "lib",
        os: "linux",
        arch: ["x86_64"],
        headers: true,
      },
      {
        id: "wasm-target",
        for: "wasm_lib",
        type: "lib",
        os: "linux",
        arch: ["wasm32"],
        headers: false,
      },
    ],
  } as unknown as RefineryConfig;

  it("should generate correct matrix entries for libraries and WebAssembly", () => {
    const yamlResult = buildWorkflowYaml(createCtx(libConfig));
    expect(yamlResult.ok).toBe(true);
    const yaml = yamlResult.value;
    const parsed = load(yaml) as {
      jobs: {
        build: {
          strategy: {
            matrix: {
              include: {
                artifact: string;
                artifact_type: string;
                headers: boolean;
                target_triple: string;
              }[];
            };
          };
        };
      };
    };
    const matrix = parsed.jobs.build.strategy.matrix.include;

    expect(matrix).toHaveLength(2);
    const linuxLib = matrix.find((e) => e.artifact === "my_lib");
    expect(linuxLib?.artifact_type).toBe("lib");
    expect(linuxLib?.headers).toBe(true);
    expect(linuxLib?.target_triple).toBe("x86_64-unknown-linux-gnu");

    const wasmLib = matrix.find((e) => e.artifact === "wasm_lib");
    expect(wasmLib?.artifact_type).toBe("lib");
    expect(wasmLib?.headers).toBe(false);
    expect(wasmLib?.target_triple).toBe("wasm32-unknown-unknown");
  });

  it("should inject cbindgen installation step", () => {
    const yamlResult = buildWorkflowYaml(createCtx(libConfig));
    expect(yamlResult.ok).toBe(true);
    const yaml = yamlResult.value;
    const parsed = load(yaml) as {
      jobs: {
        build: {
          steps: { name: string; uses?: string; with?: { tool?: string } }[];
        };
      };
    };
    const { steps } = parsed.jobs.build;
    const cbindgenStep = steps.find((s) => s.name === "Install cbindgen");
    expect(cbindgenStep).toBeDefined();
    expect(cbindgenStep?.uses).toBe("taiki-e/install-action@v2");
    expect(cbindgenStep?.with?.tool).toBe("cbindgen");
  });

  it("should generate library packaging and export steps", () => {
    const yamlResult = buildWorkflowYaml(createCtx(libConfig));
    expect(yamlResult.ok).toBe(true);
    const yaml = yamlResult.value;
    const parsed = load(yaml) as {
      jobs: {
        build: {
          steps: { name: string; if?: string }[];
        };
      };
    };
    const { steps } = parsed.jobs.build;
    expect(steps.some((s) => s.name === "Prepare Library")).toBe(true);
    expect(steps.some((s) => s.name === "Export Library")).toBe(true);
    expect(steps.some((s) => s.name === "Package Library")).toBe(true);

    const exportLib = steps.find((s) => s.name === "Export Library");
    expect(exportLib?.if).toBe(
      "matrix.artifact_type == 'lib' && (matrix.has_bin || !matrix.has_archive)",
    );
  });
});

describe("GitHub workflow toolchain pinning", () => {
  it("should include pinned toolchain version in setup step", () => {
    const pinnedConfig = {
      version: 1,
      lang: "rust",
      platform: "github",
      toolchain: "1.95.0",
      artifacts: [],
      targets: [],
    } as unknown as RefineryConfig;

    const yamlResult = buildWorkflowYaml(createCtx(pinnedConfig));
    expect(yamlResult.ok).toBe(true);
    const yaml = yamlResult.value;
    const parsed = load(yaml) as {
      jobs: { build: { steps: { name: string; with?: { toolchain?: string } }[] } };
    };
    const steps = parsed.jobs.build.steps;

    const setupStep = steps.find((s) => s.name === "Setup Rust");
    expect(setupStep).toBeDefined();
    expect(setupStep?.with?.toolchain).toBe("1.95.0");
  });

  it("should use stable as default toolchain", () => {
    const defaultConfig = {
      version: 1,
      lang: "rust",
      platform: "github",
      artifacts: [],
      targets: [],
    } as unknown as RefineryConfig;

    const yamlResult = buildWorkflowYaml(createCtx(defaultConfig));
    expect(yamlResult.ok).toBe(true);
    const yaml = yamlResult.value;
    const parsed = load(yaml) as {
      jobs: { build: { steps: { name: string; with?: { toolchain?: string } }[] } };
    };
    const steps = parsed.jobs.build.steps;

    const setupStep = steps.find((s) => s.name === "Setup Rust");
    expect(setupStep).toBeDefined();
    expect(setupStep?.with?.toolchain).toBe("stable");
  });
});
