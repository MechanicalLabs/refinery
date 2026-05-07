import { z } from "zod";

import {
  CommonBinaryArtifact,
  CommonLibraryArtifact,
  createArtifactSchema,
} from "../common/schema";

const Artifact = createArtifactSchema(CommonBinaryArtifact, CommonLibraryArtifact);

/**
 * `refinery.toml` definition for `Rust` language.
 */
export const RustConfigSchema = z
  .object({
    artifacts: z.array(Artifact).optional().default([]),
  })
  .strict();

export type RustConfig = z.infer<typeof RustConfigSchema>;
