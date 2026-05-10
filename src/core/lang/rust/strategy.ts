import { type AsyncResult, Ok } from "ripthrow";
import type { LanguageStrategy, StrategyContext } from "../../strategy/types";

export const rustStrategy: LanguageStrategy = {
  id: "rust",
  name: "Rust",
  getInitialConfig: (projectName: string) => ({
    lang: "rust",
    artifacts: [{ type: "bin", name: projectName }],
    targets: [],
  }),
  onInit: (_ctx: StrategyContext): AsyncResult<void, Error> => {
    // Rust-specific initialization logic
    return Promise.resolve(Ok());
  },
};
