import { parse, stringify } from "smol-toml";
import { type RefineryConfig, RefineryConfigSchema } from "../schema";
import { exists, readFile, writeFile } from "./fs";

const FILENAME = "refinery.toml";

export async function loadManifest(): Promise<RefineryConfig> {
  if (!exists(FILENAME)) {
    throw new Error(`Configuration file ${FILENAME} not found.`);
  }

  const raw = await readFile(FILENAME);
  const data = parse(raw);

  return RefineryConfigSchema.parse(data);
}

export async function saveManifest(config: RefineryConfig): Promise<void> {
  const validated = RefineryConfigSchema.parse(config);

  const content = stringify(validated as unknown as Record<string, unknown>);

  await writeFile(FILENAME, content);
}
