import { load } from "js-yaml";
import { type AsyncResult, Err, Ok } from "ripthrow";
import { exists, readFile } from "../core/io/fs";
import { logger } from "../ui/log";
import { sh } from "./shell";

interface ActionStep {
  run?: string;
  shell?: string;
}

interface ActionYaml {
  runs?: {
    using?: string;
    steps?: ActionStep[];
  };
}

async function findActionPath(actionName: string): Promise<string | undefined> {
  const possiblePaths = [
    `.github/actions/${actionName}/action.yml`,
    `.github/actions/${actionName}/action.yaml`,
  ];
  const results = await Promise.all(
    possiblePaths.map(async (path) => {
      const hasFile = await exists(path);
      return { path, exists: hasFile.ok && hasFile.value };
    }),
  );
  return results.find((r) => r.exists)?.path;
}

async function runSteps(
  steps: ActionStep[],
  inputs?: Record<string, unknown>,
  actionName?: string,
): AsyncResult<void, Error> {
  for (const step of steps) {
    if (step.run) {
      let runCmd = step.run;
      if (inputs) {
        for (const [key, val] of Object.entries(inputs)) {
          const pattern = new RegExp(`\\$\\{\\{\\s*inputs\\.${key}\\s*\\}\\}`, "gu");
          runCmd = runCmd.replace(pattern, String(val));
        }
      }

      // biome-ignore lint/performance/noAwaitInLoops: sequential execution of steps in composite action is required
      const result = await sh`bash -c ${runCmd}`;
      if (!result.ok) {
        return Err(
          new Error(
            `Failed to execute step in composite action '${actionName}': ${result.error.message}`,
          ),
        );
      }
    }
  }
  return Ok();
}

/**
 * Resolve and execute a composite step locally.
 * Parses the composite action definition and executes each step using Bun shell.
 */
export async function resolveComposite(
  actionName: string,
  inputs?: Record<string, unknown>,
): AsyncResult<void, Error> {
  const actionPath = await findActionPath(actionName);
  if (!actionPath) {
    return Err(new Error(`Composite action '${actionName}' not found in .github/actions/`));
  }

  const readRes = await readFile(actionPath);
  if (!readRes.ok) {
    return Err(
      new Error(`Failed to read composite action at ${actionPath}: ${readRes.error.message}`),
    );
  }

  let parsed: ActionYaml;
  try {
    parsed = load(readRes.value) as ActionYaml;
  } catch (e) {
    return Err(
      new Error(`Failed to parse composite action YAML at ${actionPath}: ${(e as Error).message}`),
    );
  }

  const { runs } = parsed;
  if (!runs || runs.using !== "composite" || !runs.steps) {
    return Err(new Error(`Action at ${actionPath} is not a valid composite action`));
  }

  logger.info(`Executing composite action: ${actionName}`);

  return runSteps(runs.steps, inputs, actionName);
}
