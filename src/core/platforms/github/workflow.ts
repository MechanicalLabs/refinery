// biome-ignore-all lint/style/useNamingConvention: YAML output keys
import { dump } from "js-yaml";
import { Ok, type Result } from "ripthrow";
import type { PublishStep, RefineryConfig } from "../../../core/schema";
import type { StrategyContext } from "../../../core/strategy/types";
import type { AppError } from "../../../errors";
import { Actions } from "./constants";
import { buildMatrix, type MatrixEntry } from "./matrix";
import { buildSteps } from "./steps";

interface Step {
  name: string;
  uses?: string;
  run?: string;
  shell?: string;
  with?: Record<string, string | boolean>;
  env?: Record<string, string>;
  if?: string;
}

const defaultPublish: PublishStep[] = [
  { type: "builtin", builtin: "download_artifact", targets: "all" },
  { type: "builtin", builtin: "github_release", targets: "all" },
];

function translatePublishBuiltinStep(step: PublishStep): Step[] {
  if (step.type !== "builtin") {
    return [];
  }
  const steps: Step[] = [];
  if (step.builtin === "download_artifact") {
    steps.push({
      name: "Download Artifacts",
      uses: Actions.downloadArtifact,
      with: {
        "merge-multiple": true,
        path: "./artifacts",
        ...(step.with ?? {}),
      },
    });
    steps.push({
      name: "Display structure",
      run: "find ./artifacts -type f | sort",
      shell: "bash",
    });
  } else if (step.builtin === "github_release") {
    steps.push({
      name: "Publish Release",
      uses: Actions.ghRelease,
      with: {
        fail_on_unmatched_files: true,
        files: "./artifacts/*",
        generate_release_notes: true,
        ...(step.with ?? {}),
      },
      env: {
        GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
      },
    });
  }
  return steps;
}

function translatePublishCompositeStep(step: PublishStep): Step[] {
  if (step.type !== "composite") {
    return [];
  }
  const s: Step = {
    name: step.name ?? `Execute ${step.action}`,
    uses: `./.github/actions/${step.action}`,
  };

  if (step.with) {
    s.with = step.with as Record<string, string | boolean>;
  }

  if (step.secrets && Array.isArray(step.secrets)) {
    s.env = {};
    for (const secret of step.secrets) {
      s.env[secret] = `\${{ secrets.${secret} }}`;
    }
  }

  return [s];
}

function translatePublishStep(step: PublishStep): Step[] {
  if (step.type === "builtin") {
    return translatePublishBuiltinStep(step);
  }
  if (step.type === "composite") {
    return translatePublishCompositeStep(step);
  }
  return [];
}

function getPublishSteps(config: RefineryConfig): PublishStep[] {
  if (config.publish && config.publish.length > 0) {
    return config.publish;
  }
  return defaultPublish;
}

function buildReleaseJob(config: RefineryConfig): Record<string, unknown> | undefined {
  const publishSteps = getPublishSteps(config);
  const activeSteps = publishSteps.filter((s) => s.enabled !== false);
  if (activeSteps.length === 0) {
    return;
  }

  const steps: Step[] = [];
  if (activeSteps.some((s) => s.type === "composite")) {
    steps.push({
      name: "Checkout repository",
      uses: Actions.checkout,
    });
  }

  for (const step of activeSteps) {
    steps.push(...translatePublishStep(step));
  }

  const permissions: Record<string, string> = {
    contents: "write",
  };

  for (const step of activeSteps) {
    if (step.type === "composite" && step.permissions) {
      for (const [key, value] of Object.entries(step.permissions)) {
        permissions[key] = String(value);
      }
    }
  }

  return {
    name: "Release Artifacts",
    needs: ["build"],
    "runs-on": "ubuntu-latest",
    if: "startsWith(github.ref, 'refs/tags/')",
    permissions,
    steps,
  };
}

function buildJobs(ctx: StrategyContext, matrix: MatrixEntry[]): Record<string, unknown> {
  const buildEnv = ctx.lang.getBuildEnv(ctx.config);

  const jobs: Record<string, unknown> = {
    build: {
      name: "${{ matrix.artifact }} (${{ matrix.os }}-${{ matrix.arch }}-${{ matrix.abi || 'default' }})",
      "runs-on": "${{ matrix.runs_on }}",
      env: {
        ...buildEnv,
      },
      strategy: {
        "fail-fast": false,
        matrix: { include: matrix },
      },
      steps: buildSteps(ctx),
    },
  };

  const releaseJob = buildReleaseJob(ctx.config);
  if (releaseJob) {
    // biome-ignore lint/complexity/useLiteralKeys: GHA
    jobs["release"] = releaseJob;
  }

  return jobs;
}

export function buildWorkflowYaml(ctx: StrategyContext): Result<string, AppError> {
  const matrixResult = buildMatrix(ctx.config);
  if (!matrixResult.ok) {
    return matrixResult;
  }

  const workflow = {
    name: "Refinery Build",
    on: {
      push: { tags: ["v*"] },
      release: { types: ["created"] },
    },
    jobs: buildJobs(ctx, matrixResult.value),
  };

  return Ok(dump(workflow, { lineWidth: 120, noRefs: true, quotingType: '"' }));
}
