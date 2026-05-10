import type { LanguageStrategy } from "../../strategy/types";

export const rustStrategy: LanguageStrategy = {
  id: "rust",
  name: "Rust",
  getInitialConfig: (projectName: string) => ({
    lang: "rust",
    artifacts: [{ type: "bin", name: projectName }],
    targets: [],
  }),
  onInit: (_projectName: string): Promise<void> => {
    // Rust-specific initialization logic (e.g., creating Cargo.toml if needed)
    // For now, it doesn't do anything extra beyond the manifest.
    return Promise.resolve();
  },
};
