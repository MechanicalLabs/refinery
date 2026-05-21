// biome-ignore-all lint/style/useNamingConvention: YAML output keys
// biome-ignore-all lint/suspicious/noTemplateCurlyInString: GHA expressions
import { dump } from "js-yaml";
import type { PublishStep, RefineryConfig } from "../../schema";
import { Actions } from "./constants";
import { buildMatrix, buildReleaseEnv } from "./matrix";
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

function buildJobs(config: RefineryConfig): Record<string, unknown> {
  const matrix = buildMatrix(config);
  const buildEnv = buildReleaseEnv(config) ?? {};

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
      steps: buildSteps(config),
    },
  };

  const releaseJob = buildReleaseJob(config);
  if (releaseJob) {
    jobs.release = releaseJob;
  }

  return jobs;
}

export function buildWorkflowYaml(config: RefineryConfig): string {
  const workflow = {
    name: "Refinery Build",
    on: {
      push: { tags: ["v*"] },
      release: { types: ["created"] },
    },
    jobs: buildJobs(config),
  };

  return dump(workflow, { lineWidth: 120, noRefs: true, quotingType: '"' });
}
