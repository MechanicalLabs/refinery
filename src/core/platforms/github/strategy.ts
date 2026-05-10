import type { PlatformStrategy } from "../../strategy/types";

export const githubStrategy: PlatformStrategy = {
  id: "github",
  name: "GitHub",
  onInit: (_projectName: string): Promise<void> => {
    // GitHub-specific initialization (e.g., creating .github/workflows/ci.yml)
    return Promise.resolve();
  },
};
