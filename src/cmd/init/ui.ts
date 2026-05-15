import pc from "picocolors";
import type {
  CommonBinaryArtifact,
  CommonLibraryArtifact,
} from "../../core/lang/common/schema/artifact";
import type { CommonBinaryTarget, CommonLibraryTarget } from "../../core/lang/common/schema/target";
import { LanguageRegistry, PlatformRegistry } from "../../core/strategy/registry";
import { logger } from "../../ui/log";
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

  const languages = LanguageRegistry.all().map((l) => ({ value: l.id, label: l.name }));
  const platforms = PlatformRegistry.all().map((p) => ({ value: p.id, label: p.name }));

  let languageStep: () => Promise<string>;
  const [firstLang] = languages;
  if (languages.length === 1 && firstLang) {
    languageStep = (): Promise<string> => {
      logger.info(`Select Language: ${pc.cyan(firstLang.label)}`);
      return Promise.resolve(firstLang.value);
    };
  } else {
    languageStep = step.select("Select Language", languages) as () => Promise<string>;
  }

  let platformStep: () => Promise<string>;
  const [firstPlat] = platforms;
  if (platforms.length === 1 && firstPlat) {
    platformStep = (): Promise<string> => {
      logger.info(`Select Platform: ${pc.cyan(firstPlat.label)}`);
      return Promise.resolve(firstPlat.value);
    };
  } else {
    platformStep = step.select("Select Platform", platforms) as () => Promise<string>;
  }

  const baseAnswers = await ui.run({
    language: languageStep,
    platform: platformStep,
  });

  const artifacts = await promptArtifacts(ui, baseAnswers.language);
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
