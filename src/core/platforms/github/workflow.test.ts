// biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: it's a test
// biome-ignore-all lint/suspicious/noTemplateCurlyInString: GHA expressions
// biome-ignore-all lint/style/useNamingConvention: YAML schema
// biome-ignore-all lint/complexity/useLiteralKeys: test assertions with bracket notation
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
    const yaml = buildWorkflowYaml(pkgConfig);
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
    const yaml = buildWorkflowYaml(pkgConfig);
    const parsed = load(yaml) as {
      jobs: {
        build: {
          steps: { name: string; if?: string; run?: string; uses?: string }[];
        };
      };
    };
    const { steps } = parsed.jobs.build;

    expect(steps.some((s) => s.name === "Setup Linker")).toBe(true);
    expect(steps.some((s) => s.name === "Install cargo-binstall")).toBe(false);
    expect(steps.some((s) => s.name === "Install cargo-deb")).toBe(true);
    expect(steps.some((s) => s.name === "Build .deb package")).toBe(true);
    expect(steps.some((s) => s.name === "Install cargo-rpm")).toBe(true);
    expect(steps.some((s) => s.name === "Build .rpm package")).toBe(true);
    expect(steps.some((s) => s.name === "Install cargo-wix")).toBe(true);
    expect(steps.some((s) => s.name === "Build .msi package")).toBe(true);
    expect(steps.some((s) => s.name === "Copy Extra Files")).toBe(true);
    // Checksums should NOT be in the build job anymore
    expect(steps.some((s) => s.name === "Generate Checksums")).toBe(false);
  });

  it("should generate conditional steps with correct if expressions", () => {
    const yaml = buildWorkflowYaml(pkgConfig);
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
    const yaml = buildWorkflowYaml(pkgConfig);
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
