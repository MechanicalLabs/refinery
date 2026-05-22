// biome-ignore-all lint/style/useNamingConvention: GHA env vars and config keys
// biome-ignore-all lint/nursery/noExcessiveLinesPerFile: GHA steps generator needs to contain all translation logic

import { PACKAGERS } from "../../packaging";
import type { PostBuildStep, PreBuildStep, RefineryConfig } from "../../schema";
import type { AbstractStep, StrategyContext, TargetMetadata } from "../../strategy/types";
import { Actions } from "./constants";
import { buildMatrix } from "./matrix";

interface Step {
  name: string;
  uses?: string;
  run?: string;
  shell?: string;
  with?: Record<string, string | boolean | number>;
  env?: Record<string, string>;
  if?: string;
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
};

const defaultPreBuild: PreBuildStep[] = [
  { type: "builtin", builtin: "checkout", targets: "all" },
  { type: "builtin", builtin: "setup_toolchain", targets: "all" },
  { type: "builtin", builtin: "setup_linker", targets: "all" },
];

const defaultPostBuild: PostBuildStep[] = [
  { type: "builtin", builtin: "package", targets: "all" },
  { type: "builtin", builtin: "upload_artifact", targets: "all" },
];

function translateSetupLinker(baseIf?: string): Step[] {
  const steps: Step[] = [
    {
      name: "Setup Linker",
      uses: Actions.setupLinker,
      with: {
        "target-triple": "${{ matrix.target_triple }}",
        "extra-apt-packages": "${{ join(matrix.apt_packages, ' ') }}",
      },
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

function translatePackage(baseIf?: string): Step[] {
  const steps: Step[] = [];

  for (const pkg of ["deb", "rpm", "msi"] as const) {
    const packager = PACKAGERS[pkg];
    if (packager) {
      for (const ps of packager.setupSteps) {
        const s: Step = { name: ps.name };
        if (ps.uses) {
          s.uses = ps.uses;
        }
        if (ps.run) {
          s.run = ps.run;
        }
        if (ps.shell) {
          s.shell = ps.shell;
        }
        if (ps.with) {
          s.with = ps.with;
        }
        if (ps.ifCondition) {
          s.if = ps.ifCondition;
        }
        steps.push(s);
      }
      for (const ps of packager.buildSteps) {
        const s: Step = { name: ps.name };
        if (ps.uses) {
          s.uses = ps.uses;
        }
        if (ps.run) {
          s.run = ps.run;
        }
        if (ps.shell) {
          s.shell = ps.shell;
        }
        if (ps.with) {
          s.with = ps.with;
        }
        if (ps.ifCondition) {
          s.if = ps.ifCondition;
        }
        steps.push(s);
      }
    }
  }

  // Add archive and bin export steps (kept here for now, as they are platform-neutral but easy to keep in builtin)
  // Actually, these should ideally be in ExportSteps of the language, but they are very similar across languages.
  // For now, let's keep them as part of the "package" builtin translation.

  for (const ps of steps) {
    if (baseIf) {
      if (ps.if) {
        ps.if = `(${ps.if}) && (${baseIf})`;
      } else {
        ps.if = baseIf;
      }
    }
  }
  return steps;
}

function translateAbstractStep(
  ctx: StrategyContext,
  step: AbstractStep,
  _config: RefineryConfig,
  baseIf?: string,
): Step[] {
  if (step.type === "shell") {
    const s: Step = {
      name: step.name,
      run: step.run,
    };
    if (step.shell) {
      s.shell = step.shell;
    }
    if (step.env) {
      s.env = step.env;
    }
    if (step.if) {
      s.if = step.if;
    }

    if (baseIf) {
      s.if = s.if ? `(${s.if}) && (${baseIf})` : baseIf;
    }
    return [s];
  }

  if (step.type === "action" || (step as any).type === "composite") {
    const s: Step = {
      name:
        step.type === "action"
          ? step.name
          : ((step as any).name ?? ((step as any).action ? `Execute ${(step as any).action}` : "")),
      uses: step.type === "action" ? step.uses : `./.github/actions/${(step as any).action}`,
    };

    if (step.with) {
      s.with = step.with as Record<string, string | boolean | number>;
    }
    if ((step as any).env) {
      s.env = (step as any).env;
    }
    if ((step as any).if) {
      s.if = (step as any).if;
    }

    if ((step as any).secrets && Array.isArray((step as any).secrets)) {
      s.env = s.env || {};
      for (const secret of (step as any).secrets) {
        s.env[secret] = `\${{ secrets.${secret} }}`;
      }
    }

    if (baseIf) {
      s.if = s.if ? `(${s.if}) && (${baseIf})` : baseIf;
    }
    return [s];
  }

  if (step.type === "builtin") {
    switch (step.builtin) {
      case "checkout": {
        const s: Step = {
          name: "Checkout",
          uses: Actions.checkout,
        };
        if (baseIf) {
          s.if = baseIf;
        }
        return [s];
      }
      case "setup_toolchain": {
        const langSetupSteps = ctx.lang.getSetupSteps(ctx, GHA_TARGET);
        const steps: Step[] = [];
        for (const s of langSetupSteps) {
          // If it's the main toolchain setup, we might want to preserve some defaults
          if (s.type === "builtin" && s.builtin === "setup_toolchain") {
            const stepObj: Step = {
              name: s.name ?? step.name ?? "Setup Toolchain",
              uses: Actions.setupRust, // Hardcoded for now
              with: {
                target: "${{ matrix.target_triple }}",
                cache: true,
                ...(s.with ?? {}),
                ...(step.with ?? {}),
              },
            };
            if (baseIf) {
              stepObj.if = baseIf;
            }
            steps.push(stepObj);
          } else {
            steps.push(...translateAbstractStep(ctx, s, _config, baseIf));
          }
        }
        return steps;
      }
      case "setup_linker":
        return translateSetupLinker(baseIf);
      case "package":
        return translatePackage(baseIf);
      case "upload_artifact": {
        const s: Step = {
          name: "Upload Artifact",
          uses: Actions.uploadArtifact,
          with: {
            name: "${{ matrix.output_name }}",
            path: "_packages/",
            ...(step.with ?? {}),
          },
        };
        if (baseIf) {
          s.if = baseIf;
        }
        return [s];
      }
      default:
        return [];
    }
  }

  return [];
}

function getMatchingTriples(
  targetIds: string[],
  config: RefineryConfig,
  entries: ReturnType<typeof buildMatrix>,
): string[] {
  const matchingTriples: string[] = [];
  for (const targetId of targetIds) {
    const target = config.targets?.find((t) => t.id === targetId);
    if (target) {
      for (const arch of target.arch) {
        const entry = entries.find(
          (e) =>
            e.artifact === target.for &&
            e.os === target.os &&
            e.arch === arch &&
            e.abi === target.abi,
        );
        if (entry) {
          matchingTriples.push(entry.target_triple);
        }
      }
    }
  }
  return matchingTriples;
}

function getTargetsCondition(
  targets: "once" | "all" | string[],
  config: RefineryConfig,
  entries: ReturnType<typeof buildMatrix>,
): string | undefined {
  let result: string | undefined;
  if (targets === "once") {
    const firstTriple = entries[0]?.target_triple;
    if (firstTriple) {
      result = `matrix.target_triple == '${firstTriple}'`;
    }
  } else if (Array.isArray(targets)) {
    const triples = getMatchingTriples(targets, config, entries);
    if (triples.length > 0) {
      result = triples.map((t) => `matrix.target_triple == '${t}'`).join(" || ");
    }
  }
  return result;
}

function getStepIfCondition(
  step: PreBuildStep | PostBuildStep,
  config: RefineryConfig,
): string | undefined {
  const targets = step.targets ?? "once";
  if (targets === "all") {
    return;
  }

  const entries = buildMatrix(config);
  if (entries.length === 0) {
    return;
  }

  return getTargetsCondition(targets, config, entries);
}

export function buildSteps(ctx: StrategyContext): Step[] {
  const steps: Step[] = [];
  const { config, lang } = ctx;

  let preBuildSteps = defaultPreBuild;
  if (config.pre_build && config.pre_build.length > 0) {
    preBuildSteps = config.pre_build;
  }

  for (const step of preBuildSteps) {
    if (step.enabled === false) {
      continue;
    }

    const baseIf = getStepIfCondition(step, config);
    if (step.type === "builtin") {
      // For builtins, we let the strategy provide setup/build/export steps if needed,
      // but here we are translating the pre_build/post_build blocks from the manifest.
      // If it's a builtin in the manifest, we use our local translation.
      steps.push(...translateAbstractStep(ctx, { ...step } as AbstractStep, config, baseIf));
    } else {
      steps.push(...translateAbstractStep(ctx, step as unknown as AbstractStep, config, baseIf));
    }
  }

  // Compilation steps from Language Strategy
  const langBuildSteps = lang.getBuildSteps(ctx, GHA_TARGET);
  for (const s of langBuildSteps) {
    steps.push(...translateAbstractStep(ctx, s, config));
  }

  let postBuildSteps = defaultPostBuild;
  if (config.post_build && config.post_build.length > 0) {
    postBuildSteps = config.post_build;
  }

  for (const step of postBuildSteps) {
    if (step.enabled === false) {
      continue;
    }

    const baseIf = getStepIfCondition(step, config);
    if (step.type === "builtin") {
      // Special case: "package" builtin should also include Lang's ExportSteps
      if (step.builtin === "package") {
        const langExportSteps = lang.getExportSteps(ctx, GHA_TARGET);
        for (const s of langExportSteps) {
          // Filter out builtins from ExportSteps that we are already handling here
          if (
            s.type === "builtin" &&
            (s.builtin === "package" || s.builtin === "upload_artifact")
          ) {
            continue;
          }
          steps.push(...translateAbstractStep(ctx, s, config, baseIf));
        }
      }
      steps.push(...translateAbstractStep(ctx, { ...step } as AbstractStep, config, baseIf));
    } else {
      steps.push(...translateAbstractStep(ctx, step as unknown as AbstractStep, config, baseIf));
    }
  }

  return steps;
}
