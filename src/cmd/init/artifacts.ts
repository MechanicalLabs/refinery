import path from "node:path";
import { isCancel } from "@clack/prompts";
import { Ok } from "ripthrow";
import type {
  CommonBinaryArtifact,
  CommonLibraryArtifact,
} from "../../core/lang/common/schema/artifact";
import { type PromptGroup, step, toUiValidator } from "../../ui/prompt";
import { slugify, validateName } from "../../utils/naming";

type Artifact = CommonBinaryArtifact | CommonLibraryArtifact;

/**
 * Interactive wizard to define one or more project artifacts.
 */
async function promptArtifacts(ui: PromptGroup): Promise<Artifact[] | undefined> {
  const artifacts: Artifact[] = [];
  const folderName = slugify(path.basename(process.cwd()));

  const firstArtifact = await promptFirstArtifact(folderName);
  if (!firstArtifact) {
    return;
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
      artifacts.push({ type: "bin", name: artifactAnswers.name, outputName: artifactAnswers.name });
    } else {
      artifacts.push({ type: "lib", name: artifactAnswers.name, headers: false });
    }

    addAnother = await step.confirm("Add another artifact?", false)();
    if (isCancel(addAnother)) {
      return;
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
    return;
  }

  let firstDefault: string;
  if (firstType === "bin") {
    firstDefault = folderName;
  } else {
    firstDefault = `${folderName}-lib`;
  }

  const firstName = await step.text("Artifact Name", firstDefault, toUiValidator(validateName))();

  if (isCancel(firstName)) {
    return;
  }

  if (firstType === "bin") {
    return { type: "bin", name: firstName, outputName: firstName };
  }

  return { type: "lib", name: firstName, headers: false };
}

export { promptArtifacts };
