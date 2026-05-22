import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const IMAGE_NAME = "refinery-e2e";
const PROJECT_ROOT = process.cwd();

export function ensureImageBuilt(): void {
  const result = spawnSync(
    "docker",
    ["build", "-t", IMAGE_NAME, "-f", "tests/e2e/Dockerfile", "."],
    {
      stdio: "inherit",
    },
  );

  if (result.status !== 0) {
    throw new Error("Failed to build E2E Docker image");
  }
}

export interface DockerResult {
  stdout: string;
  stderr: string;
  output: string;
  exitCode: number | null;
}

export function runInIsolatedDocker(args: string[], setupCmds?: string[]): DockerResult {
  const workspaceId = randomUUID();
  const workDir = `/tmp/refinery-e2e-${workspaceId}`;

  const bashScript = [
    `mkdir -p ${workDir}`,
    `cd ${workDir}`,
    ...(setupCmds ?? []),
    `bun /src/index.ts ${args.join(" ")}`,
  ].join(" && ");

  const dockerArgs = [
    "run",
    "--rm",
    "-v",
    `${PROJECT_ROOT}/src:/src:ro`,
    "-v",
    `${PROJECT_ROOT}/node_modules:/node_modules:ro`,
    "-v",
    `${PROJECT_ROOT}/package.json:/package.json:ro`,
    "-v",
    `${PROJECT_ROOT}/tsconfig.json:/tsconfig.json:ro`,
    "-v",
    `${PROJECT_ROOT}/biome.json:/biome.json:ro`,
    IMAGE_NAME,
    "bash",
    "-c",
    bashScript,
  ];

  const result = spawnSync("docker", dockerArgs, { encoding: "utf-8" });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    output: result.stdout + result.stderr,
    exitCode: result.status,
  };
}
