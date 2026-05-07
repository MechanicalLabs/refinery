import pc from "picocolors";

import { logger } from "../ui/log";
import { PromptGroup, step } from "../ui/prompt";
import type { Cmd } from ".";

const PROJECT_REGEXP = /[^a-zA-Z0-9-_]/u;

interface RefineryInitData {
  name: string;
  language: "rust";
  platform: "github";
}

async function runInit(): Promise<void> {
  const ui = new PromptGroup("Refinery", "Setup");

  const project = await ui.run<RefineryInitData>({
    // @ts-expect-error: Not all code paths return a value
    // This is intentional to allow for validation errors to be returned
    name: step.text("Project Name", "refinery-app", (v: string) => {
      if (!v.trim()) {
        return "Name is required";
      }
      if (PROJECT_REGEXP.test(v)) {
        return "Name can only contain letters, numbers, dashes, and underscores";
      }
    }),

    language: () => Promise.resolve("rust"),
    platform: () => Promise.resolve("github"),

    // Uncomment when more options are added
    /**
    language: step.select("Project Language", [
      { value: "rust", label: "Rust", hint: "Setup Refinery for Rust" },
    ]),

    platform: step.select("CI Platform", [{ value: "github", label: "GitHub Actions" }]),
     */
  });

  PromptGroup.outro(`Project ${pc.red(project.name)} initialized.`);
}

export const initCmd: Cmd = {
  name: "init",
  description: "Initialize project",
  action: (): void => {
    runInit().catch((err: unknown): void => {
      logger.error("Error:", err);
      process.exit(1);
    });
  },
};
