import path from "node:path";
import { type AsyncResult, buildAsync, Ok } from "ripthrow";
import type { PlatformStrategy, StrategyContext } from "../../strategy/types";
import { buildWorkflowYaml } from "./workflow";

const WORKFLOW_DIR = path.join(".github", "workflows");

export const githubStrategy: PlatformStrategy = {
  id: "github",
  name: "GitHub",
  onInit: (_ctx: StrategyContext): AsyncResult<void, Error> => Promise.resolve(Ok()),
  migrate: (ctx: StrategyContext): AsyncResult<void, Error> =>
    buildAsync(ctx.sys.fs.mkdir(path.join(ctx.cwd, WORKFLOW_DIR)))
      .andThen(() =>
        ctx.sys.fs.writeFile(
          path.join(ctx.cwd, WORKFLOW_DIR, "refinery-build.yml"),
          buildWorkflowYaml(ctx.config),
        ),
      )
      .map(() => undefined).result,
};
