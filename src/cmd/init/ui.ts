import type {
  CommonBinaryArtifact,
  CommonLibraryArtifact,
} from "../../core/lang/common/schema/artifact";
import type { CommonBinaryTarget, CommonLibraryTarget } from "../../core/lang/common/schema/target";
import { LanguageRegistry, PlatformRegistry } from "../../core/strategy/registry";
import { PromptGroup, step } from "../../ui/prompt";
import { promptArtifacts } from "./artifacts";
import { promptTargets } from "./targets";

export interface ProjectAnswers {
  language: string;
  platform: string;
  artifacts: (CommonBinaryArtifact | CommonLibraryArtifact)[];
  targets: (CommonBinaryTarget | CommonLibraryTarget)[];
}

export async function promptUser(): Promise<ProjectAnswers | undefined> {
  const ui = new PromptGroup("Refinery", "Setup");

  const baseAnswers = await ui.run({
    language: step.select(
      "Select Language",
      LanguageRegistry.all().map((l) => ({ value: l.id, label: l.name })),
    ),
    platform: step.select(
      "Select Platform",
      PlatformRegistry.all().map((p) => ({ value: p.id, label: p.name })),
    ),
  });

  const artifacts = await promptArtifacts(ui);
  if (!artifacts) {
    return;
  }

  const targets = await promptTargets(artifacts);
  if (!targets) {
    return;
  }

  return {
    ...baseAnswers,
    artifacts,
    targets,
  };
}
