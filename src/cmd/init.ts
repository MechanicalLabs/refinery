import pc from "picocolors";
import { match } from "ripthrow";
import { loadManifest, saveManifest } from "../core/io/manifest";
import type { RefineryConfig } from "../core/schema";
import { IoFileNotFound } from "../errors/io/file-not-found";
import { ProjectNameInvalidError } from "../errors/project-name-invalid";
import { ProjectNameRequiredError } from "../errors/project-name-required";
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
  const manifestResult = await loadManifest();

  const alreadyExists = match(manifestResult, {
    ok: () => true,
    err: (err: Error) => {
      if (err instanceof IoFileNotFound) {
        return false;
      }

      logger.error("Existing manifest is corrupted:", err.message);
      process.exit(1);
    },
  });

  if (alreadyExists) {
    logger.warn(pc.yellow("A refinery.toml manifest already exists."));
    process.exit(1);
  }

  const ui = new PromptGroup("Refinery", "Setup");

  const project = await ui.run<RefineryInitData>({
    name: step.text("Project Name", "refinery-app", validateProjectName),

    language: () => Promise.resolve("rust"),
    platform: () => Promise.resolve("github"),
  });

  const manifest: RefineryConfig = {
    version: 1,
    lang: project.language,
    platform: project.platform,
    artifacts: [
      {
        type: "bin",
        name: project.name,
      },
    ],
  };

  await saveManifest(manifest);

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
