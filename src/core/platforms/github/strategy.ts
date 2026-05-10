import { type AsyncResult, Ok } from "ripthrow";
import type { PlatformStrategy, StrategyContext } from "../../strategy/types";

export const githubStrategy: PlatformStrategy = {
  id: "github",
  name: "GitHub",
  onInit: (_ctx: StrategyContext): AsyncResult<void, Error> => {
    // GitHub-specific initialization
    return Promise.resolve(Ok());
  },
};
