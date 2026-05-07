import pc from "picocolors";
import { ProjectNameInvalidError, ProjectNameRequiredError } from "../error";
import { logger } from "../ui/log";
import { PromptGroup, step } from "../ui/prompt";
import type { Cmd } from ".";

const PROJECT_REGEXP = /[^a-zA-Z0-9-_]/u;

// @ts-expect-error: Not all code paths return a value
// This is intentional to allow for validation errors to be returned
function validateProjectName(v: string): string | undefined {
  if (!v.trim()) {
    return new ProjectNameRequiredError().message;
  }
  if (PROJECT_REGEXP.test(v)) {
    return new ProjectNameInvalidError().message;
  }
}

interface RefineryInitData {
  name: string;
  language: "rust";
  platform: "github";
}

async function runInit(): Promise<void> {
  const ui = new PromptGroup("Refinery", "Setup");

  const project = await ui.run<RefineryInitData>({
    name: step.text("Project Name", "refinery-app", validateProjectName),

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

export { validateProjectName };
