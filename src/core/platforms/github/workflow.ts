// biome-ignore-all lint/style/useNamingConvention: YAML output keys
// biome-ignore-all lint/suspicious/noTemplateCurlyInString: GHA expressions
import { dump } from "js-yaml";
import type { RefineryConfig } from "../../schema";
import { Actions } from "./constants";
import { buildMatrix, buildReleaseEnv } from "./matrix";
import { buildSteps } from "./steps";

function buildReleaseJob(): Record<string, unknown> {
  return {
    name: "Release Artifacts",
    needs: ["build"],
    "runs-on": "ubuntu-latest",
    if: "startsWith(github.ref, 'refs/tags/')",
    permissions: {
      contents: "write",
    },
    steps: [
      {
        name: "Download Artifacts",
        uses: Actions.downloadArtifact,
        with: {
          "merge-multiple": true,
          path: "./artifacts",
        },
      },
      {
        name: "Display structure",
        run: "find ./artifacts -type f | sort",
        shell: "bash",
      },
      {
        name: "Publish Release",
        uses: Actions.ghRelease,
        with: {
          fail_on_unmatched_files: true,
          files: "./artifacts/*",
          generate_release_notes: true,
        },
        env: {
          GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
        },
      },
    ],
  };
}

function buildJobs(config: RefineryConfig): Record<string, unknown> {
  const matrix = buildMatrix(config);
  const buildEnv = buildReleaseEnv(config) ?? {};

  return {
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
      steps: buildSteps(),
    },
    release: buildReleaseJob(),
  };
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
