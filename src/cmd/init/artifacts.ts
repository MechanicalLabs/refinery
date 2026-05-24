import path from "node:path";
import { isCancel } from "@clack/prompts";
import { Ok } from "ripthrow";
import type {
  CommonBinaryArtifact,
  CommonLibraryArtifact,
} from "../../core/lang/common/schema/artifact";
import { LanguageRegistry } from "../../core/strategy/registry";
import { logger } from "../../ui/log";
import { type PromptGroup, step, toUiValidator } from "../../ui/prompt";
import { slugify, validateName } from "../../utils/naming";

type Artifact = CommonBinaryArtifact | CommonLibraryArtifact;

/**
 * Interactive wizard to define one or more project artifacts.
 * Delegates auto-detection to the selected language strategy.
 */
async function promptArtifacts(ui: PromptGroup, language: string): Promise<Artifact[] | undefined> {
  const langResult = LanguageRegistry.get(language);
  if (!langResult.ok) {
    logger.error(`Language '${language}' is not supported.`);
    return undefined;
  }
  const lang = langResult.value;

  // Try auto-detection first
  const detectResult = await lang.detectArtifacts(process.cwd());
  if (detectResult.ok && detectResult.value.length > 0) {
    logger.info(`Detected ${detectResult.value.length} artifact(s):`);
    for (const a of detectResult.value) {
      const label = a.type === "bin" ? "bin" : "lib";
      logger.info(`  ${label}: ${a.name}`);
    }
    return detectResult.value;
  }

  // Fall back to manual artifact prompt
  const artifacts: Artifact[] = [];
  const folderName = slugify(path.basename(process.cwd()));

  const firstArtifact = await promptFirstArtifact(folderName);
  if (!firstArtifact) {
    return undefined;
  }
  artifacts.push(firstArtifact);

  let addAnother = await step.confirm("Add another artifact?", false)();

  while (addAnother === true) {
    // biome-ignore lint/performance/noAwaitInLoops: interactive terminal flows require sequential await
    const artifactAnswers = await ui.run({
      type: step.select("Artifact Type", [
        { value: "bin", label: "Binary" },
        { value: "lib", label: "Library" },
      ]),
      name: step.text(
        "Artifact Name",
        "",
        toUiValidator((v) => {
          const res = validateName(v);
          if (!res.ok) {
            return res;
          }
          if (artifacts.some((a: Artifact): boolean => a.name === v.trim())) {
            return { ok: false, error: "Artifact name must be unique" };
          }
          return Ok();
        }),
      ),
    });

    if (artifactAnswers.type === "bin") {
      artifacts.push({ type: "bin", name: artifactAnswers.name, outputName: "{name}-{os}-{arch}" });
    } else {
      artifacts.push({ type: "lib", name: artifactAnswers.name, headers: false });
    }

    addAnother = await step.confirm("Add another artifact?", false)();
    if (isCancel(addAnother)) {
      return undefined;
    }
  }

  return artifacts;
}

/**
 * Handles the first artifact creation with sensible defaults based on the folder name.
 */
async function promptFirstArtifact(folderName: string): Promise<Artifact | undefined> {
  const firstType = await step.select("First Artifact Type", [
    { value: "bin", label: "Binary" },
    { value: "lib", label: "Library" },
  ])();

  if (isCancel(firstType)) {
    return undefined;
  }

  let firstDefault: string;
  if (firstType === "bin") {
    firstDefault = folderName;
  } else {
    firstDefault = `${folderName}-lib`;
  }

  const firstName = await step.text("Artifact Name", firstDefault, toUiValidator(validateName))();

  if (isCancel(firstName)) {
    return undefined;
  }

  if (firstType === "bin") {
    return { type: "bin", name: firstName, outputName: "{name}-{os}-{arch}" };
  }

  return { type: "lib", name: firstName, headers: false };
}

export { promptArtifacts };
