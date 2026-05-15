import path from "node:path";
import { isCancel } from "@clack/prompts";
import { buildAsync, matchErr, Ok } from "ripthrow";
import { exists, readFile } from "../../core/io/fs";
import type {
  CommonBinaryArtifact,
  CommonLibraryArtifact,
} from "../../core/lang/common/schema/artifact";
import { Errors } from "../../errors";
import { logger } from "../../ui/log";
import { type PromptGroup, step, toUiValidator } from "../../ui/prompt";
import { parseCargoToml } from "../../utils/cargo";
import { slugify, validateName } from "../../utils/naming";

type Artifact = CommonBinaryArtifact | CommonLibraryArtifact;

function detectRustArtifacts(content: string): Artifact[] {
  const info = parseCargoToml(content);
  const artifacts: Artifact[] = [];

  let bins: string[];
  if (info.binNames.length > 0) {
    bins = info.binNames;
  } else {
    bins = [info.packageName];
  }
  for (const name of bins) {
    artifacts.push({ type: "bin", name, outputName: "{name}-{os}-{arch}" });
  }

  for (const name of info.libNames) {
    artifacts.push({ type: "lib", name, headers: false });
  }

  return artifacts;
}

async function promptRustArtifacts(): Promise<Artifact[] | undefined> {
  const result = await buildAsync(exists("Cargo.toml"))
    .andThen(() => readFile("Cargo.toml"))
    .map(detectRustArtifacts).result;

  if (result.ok) {
    const artifacts = result.value;
    if (artifacts.length === 0) {
      logger.error("No binaries or libraries found in Cargo.toml.");
      return;
    }

    logger.info(`Detected ${artifacts.length} artifact(s) from Cargo.toml:`);
    for (const a of artifacts) {
      let label = "lib";
      if (a.type === "bin") {
        label = "bin";
      }
      logger.info(`  ${label}: ${a.name}`);
    }
    return artifacts;
  }

  return matchErr(result)
    .on(Errors.ioFileNotFound, () => {
      logger.error("No Cargo.toml found. Run `cargo init` or `cargo new` first.");
    })
    .otherwise((err) => {
      logger.error(`Failed to read Cargo.toml: ${err.message}`);
    }) as Artifact[] | undefined;
}

/**
 * Interactive wizard to define one or more project artifacts.
 * For Rust, artifacts are auto-detected from Cargo.toml.
 */
async function promptArtifacts(ui: PromptGroup, language: string): Promise<Artifact[] | undefined> {
  if (language === "rust") {
    return promptRustArtifacts();
  }

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
      artifacts.push({ type: "bin", name: artifactAnswers.name, outputName: "{name}-{os}-{arch}" });
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
    return { type: "bin", name: firstName, outputName: "{name}-{os}-{arch}" };
  }

  return { type: "lib", name: firstName, headers: false };
}

export { promptArtifacts };
