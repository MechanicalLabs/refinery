// biome-ignore-all lint/style/useNamingConvention: GHA env vars and config keys
// biome-ignore-all lint/nursery/noExcessiveLinesPerFile: GHA steps generator needs to contain all translation logic

import type { PostBuildStep, PreBuildStep, RefineryConfig } from "../../schema";
import type { AbstractStep, StrategyContext, TargetMetadata } from "../../strategy/types";
import { Actions } from "./constants";
import { buildMatrix } from "./matrix";

interface GitHubStep {
  name: string;
  uses?: string | undefined;
  run?: string | undefined;
  shell?: string | undefined;
  with?: Record<string, string | boolean | number> | undefined;
  env?: Record<string, string> | undefined;
  if?: string | undefined;
}

const GHA_TARGET: TargetMetadata = {
  artifact: "${{ matrix.artifact }}",
  artifactType: "${{ matrix.artifact_type }}" as "bin" | "lib",
  os: "${{ matrix.os }}",
  arch: "${{ matrix.arch }}",
  triple: "${{ matrix.target_triple }}",
  outputName: "${{ matrix.output_name }}",
  artifactBin: "${{ matrix.artifact_bin }}",
  binExt: "${{ matrix.bin_ext }}",
  headers: "${{ matrix.headers }}" as unknown as boolean,
  packages: [],
  includeFiles: ["${{ join(matrix.include_files, ' ') }}"],
  aptPackages: [],
  features: "${{ matrix.features_str }}",
  defaultFeatures: "${{ matrix.default_features }}" as unknown as boolean,
};

/**
 * Translates the setup_linker builtin into a single, robust step.
 */
function translateSetupLinker(baseIf?: string): GitHubStep[] {
  const steps: GitHubStep[] = [
    {
      name: "Configure Linker and System Dependencies",
      if: baseIf
        ? `(join(matrix.apt_packages, '') != '' || join(matrix.linker_env, '') != '') && (${baseIf})`
        : "join(matrix.apt_packages, '') != '' || join(matrix.linker_env, '') != ''",
      run: [
        "PKGS=\"${{ join(matrix.apt_packages, ' ') }}\"",
        'if [ -n "$PKGS" ] && [ "${{ runner.os }}" = "Linux" ]; then',
        "  sudo apt-get update && sudo apt-get install --no-install-recommends -y $PKGS",
        "fi",
        "",
        'for env_var in "${{ join(matrix.linker_env, \'" "\') }}"; do',
        '  if [ -n "$env_var" ]; then',
        '    echo "$env_var" >> "$GITHUB_ENV"',
        "  fi",
        "done",
      ].join("\n"),
      shell: "bash",
    },
    {
      name: "Install System Dependencies (Windows) [WiX]",
      if: "runner.os == 'Windows' && matrix.has_msi",
      run: `choco install wixtoolset -y
$wixDir = Get-ChildItem "\${env:ProgramFiles}\\WiX*", "C:\\Program Files (x86)\\WiX*" -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
if ($wixDir -and (Test-Path "$($wixDir.FullName)\\bin\\candle.exe")) {
  Add-Content $env:GITHUB_PATH "$($wixDir.FullName)\\bin"
}`,
      shell: "powershell",
    },
    {
      name: "Set up MinGW (x86_64)",
      if: "runner.os == 'Windows' && matrix.abi == 'gnu' && matrix.arch == 'x86_64'",
      uses: Actions.setupMingw,
      with: {
        platform: "x64",
      },
    },
    {
      name: "Set up MinGW (i686)",
      if: "runner.os == 'Windows' && matrix.abi == 'gnu' && matrix.arch == 'x86'",
      uses: Actions.setupMingw,
      with: {
        platform: "x86",
      },
    },
  ];

  for (const ds of steps) {
    if (baseIf) {
      if (ds.if) {
        ds.if = `(${ds.if}) && (${baseIf})`;
      } else {
        ds.if = baseIf;
      }
    }
  }
  return steps;
}

/**
 * Maps packaging step names to their corresponding matrix condition flags.
 */
const PACKAGE_CONDITIONS: Record<string, string> = {
  ".deb": "${{ matrix.has_deb }}",
  ".rpm": "${{ matrix.has_rpm }}",
  ".msi": "${{ matrix.has_msi }}",
  "cargo-wix": "${{ matrix.has_msi }}",
  deb: "${{ matrix.has_deb }}",
  rpm: "${{ matrix.has_rpm }}",
  msi: "${{ matrix.has_msi }}",
  wix: "${{ matrix.has_msi }}",
};

/**
 * Translates the package builtin by delegating entirely to the Language Strategy.
 */
function translatePackage(
  ctx: StrategyContext,
  config: RefineryConfig,
  baseIf?: string,
): GitHubStep[] {
  const steps: GitHubStep[] = [];

  for (const s of ctx.lang.getExportSteps(ctx, GHA_TARGET)) {
    // Skip package/upload_artifact builtins to avoid recursion
    if (s.type === "builtin" && (s.builtin === "package" || s.builtin === "upload_artifact")) {
      continue;
    }

    // In GHA, package-specific steps are conditioned on matrix flags (has_deb, has_rpm, has_msi).
    // Derive condition from step name: if the name contains "deb"/"rpm"/"msi", gate on the flag.
    let stepIf = s.if;
    if (!stepIf && s.name) {
      for (const [key, flag] of Object.entries(PACKAGE_CONDITIONS)) {
        if (s.name.toLowerCase().includes(key)) {
          stepIf = flag;
          break;
        }
      }
    }

    const conditioned: AbstractStep = stepIf ? { ...s, if: stepIf } : s;
    steps.push(...translateAbstractStep(ctx, conditioned, config, baseIf));
  }

  return steps;
}

/**
 * Combines a step's own `if` condition with a base `if` from the caller.
 */
function mergeIf(stepIf: string | undefined, baseIf: string | undefined): string | undefined {
  if (baseIf) {
    return stepIf ? `(${stepIf}) && (${baseIf})` : baseIf;
  }
  return stepIf;
}

function translateAbstractStep(
  ctx: StrategyContext,
  step: AbstractStep,
  config: RefineryConfig,
  baseIf?: string,
): GitHubStep[] {
  if (step.type === "shell") {
    const s: GitHubStep = {
      name: step.name,
      run: Array.isArray(step.run) ? step.run.join("\n") : step.run,
      shell: step.shell,
      env: step.env,
      if: mergeIf(step.if, baseIf),
    };
    return [s];
  }

  if (step.type === "action") {
    const s: GitHubStep = {
      name: step.name ?? "Execute Action",
      uses: step.uses,
      with: step.with as Record<string, string | boolean | number>,
      env: step.env,
      if: mergeIf(step.if, baseIf),
    };
    return [s];
  }

  if (step.type === "composite") {
    const s: GitHubStep = {
      name: step.name ?? "Execute Action",
      uses: `./.github/actions/${step.action}`,
      with: step.with as Record<string, string | boolean | number>,
      env: step.env,
      if: mergeIf(step.if, baseIf),
    };
    return [s];
  }

  if (step.type === "builtin") {
    switch (step.builtin) {
      case "checkout":
        return [{ name: "Checkout", uses: Actions.checkout, if: baseIf }];

      case "setup_toolchain": {
        const results: GitHubStep[] = [];
        // Add Rust toolchain setup
        results.push({
          name: step.name || "Setup Rust",
          uses: Actions.setupRust,
          if: baseIf,
          with: {
            target: "${{ matrix.target_triple }}",
            cache: true,
            toolchain: ctx.lang.getToolchainVersion(config),
            ...(step.with ?? {}),
          },
        });
        // Add language-specific setup steps (e.g. cbindgen via install_tool)
        const langSetup = ctx.lang.getSetupSteps(ctx, GHA_TARGET);
        for (const s of langSetup) {
          // Skip setup builtins to avoid infinite recursion
          if (
            s.type === "builtin" &&
            (s.builtin === "setup_toolchain" || s.builtin === "setup_linker")
          ) {
            continue;
          }
          results.push(...translateAbstractStep(ctx, s, config, baseIf));
        }
        return results;
      }

      case "setup_linker":
        return translateSetupLinker(baseIf);

      case "install_tool":
        return [
          {
            name: step.name || `Install ${(step.with as { tool?: string })?.tool}`,
            uses: Actions.installAction,
            if: mergeIf(step.if, baseIf),
            with: step.with as Record<string, string | boolean | number>,
          },
        ];

      case "package":
        return translatePackage(ctx, config, baseIf);

      case "upload_artifact":
        return [
          {
            name: "Upload Artifact",
            uses: Actions.uploadArtifact,
            if: baseIf,
            with: {
              name: "${{ matrix.output_name }}",
              path: "_packages/",
              ...(step.with ?? {}),
            },
          },
        ];

      default:
        return [];
    }
  }

  return [];
}

function getStepIfCondition(
  step: PreBuildStep | PostBuildStep,
  config: RefineryConfig,
): string | undefined {
  const targets = step.targets ?? "once";
  if (targets === "all") {
    return undefined;
  }

  const matrixResult = buildMatrix(config);
  if (!matrixResult.ok) {
    return undefined;
  }
  const entries = matrixResult.value;
  if (entries.length === 0) {
    return undefined;
  }

  if (targets === "once") {
    const firstTriple = entries[0]?.target_triple;
    return firstTriple ? `matrix.target_triple == '${firstTriple}'` : undefined;
  }

  if (Array.isArray(targets)) {
    const matchingTriples: string[] = [];
    for (const targetId of targets) {
      const target = config.targets?.find((t) => t.id === targetId);
      if (!target) {
        continue;
      }
      for (const arch of target.arch) {
        const entry = entries.find(
          (e) => e.artifact === target.for && e.os === target.os && e.arch === arch,
        );
        if (entry) {
          matchingTriples.push(entry.target_triple);
        }
      }
    }
    return matchingTriples.length > 0
      ? matchingTriples.map((t) => `matrix.target_triple == '${t}'`).join(" || ")
      : undefined;
  }

  return undefined;
}

/**
 * Generates the GitHub Actions workflow steps.
 * Delegates entirely to the Language Strategy for build/export logic.
 */
export function buildSteps(ctx: StrategyContext): GitHubStep[] {
  const { config, lang } = ctx;
  const steps: GitHubStep[] = [];

  // 1. Mandatory Core Setup
  steps.push(...translateAbstractStep(ctx, { type: "builtin", builtin: "checkout" }, config));
  steps.push(
    ...translateAbstractStep(ctx, { type: "builtin", builtin: "setup_toolchain" }, config),
  );
  steps.push(...translateAbstractStep(ctx, { type: "builtin", builtin: "setup_linker" }, config));

  // 2. Pre-build Hooks
  if (config.pre_build) {
    for (const s of config.pre_build) {
      if (s.enabled === false || s.type === "builtin") {
        continue;
      }
      steps.push(
        ...translateAbstractStep(
          ctx,
          s as unknown as AbstractStep,
          config,
          getStepIfCondition(s, config),
        ),
      );
    }
  }

  // 3. Main Build
  for (const s of lang.getBuildSteps(ctx, GHA_TARGET)) {
    steps.push(...translateAbstractStep(ctx, s, config));
  }

  // 4. Post-build Hooks
  if (config.post_build) {
    for (const s of config.post_build) {
      if (s.enabled === false || s.type === "builtin") {
        continue;
      }
      steps.push(
        ...translateAbstractStep(
          ctx,
          s as unknown as AbstractStep,
          config,
          getStepIfCondition(s, config),
        ),
      );
    }
  }

  // 5. Finalize Packaging & Upload
  steps.push(...translateAbstractStep(ctx, { type: "builtin", builtin: "package" }, config));
  steps.push(
    ...translateAbstractStep(ctx, { type: "builtin", builtin: "upload_artifact" }, config),
  );

  return steps;
}
