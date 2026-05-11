import { z } from "zod";
import { createArtifactUnionHelper } from "../../../utils/create-artifact-union-helper";
import { CommonBinaryArtifact, CommonLibraryArtifact, Target } from "../common/schema";
import { validateConfigReferences } from "../common/vaildations";

const Artifact = createArtifactUnionHelper(CommonBinaryArtifact, CommonLibraryArtifact);

/**
 * `refinery.toml` definition for `Rust` language.
 */
export const RustConfigSchema = z
  .object({
    artifacts: z.array(Artifact).optional().default([]),
    targets: z.array(Target).optional().default([]),
  })
  .strict()
  .superRefine(validateConfigReferences);

/** @lintignore */
export type RustConfig = z.infer<typeof RustConfigSchema>;
