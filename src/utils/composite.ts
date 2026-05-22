import { load } from "js-yaml";
import { type AsyncResult, Err, Ok, safe } from "ripthrow";
import { exists, readFile } from "../core/io/fs";
import { Errors } from "../errors";
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
          Errors.stepExecutionFailed({
            step: `Action step in ${actionName}`,
            reason: result.error.message,
          }),
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
    return Err(Errors.compositeActionNotFound({ name: actionName }));
  }

  const readRes = await readFile(actionPath);
  if (!readRes.ok) {
    return Err(
      Errors.compositeActionReadFailed({ path: actionPath, reason: readRes.error.message }),
    );
  }

  const parseResult = safe(() => load(readRes.value) as ActionYaml);
  if (!parseResult.ok) {
    return Err(
      Errors.compositeActionParseFailed({
        path: actionPath,
        reason: (parseResult.error as Error).message,
      }),
    );
  }

  const parsed = parseResult.value;
  const { runs } = parsed;
  if (!runs || runs.using !== "composite" || !runs.steps) {
    return Err(Errors.invalidCompositeAction({ path: actionPath }));
  }

  logger.info(`Executing composite action: ${actionName}`);

  return runSteps(runs.steps, inputs, actionName);
}
