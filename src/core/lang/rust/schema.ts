import { z } from "zod";
import { createArtifactUnionHelper } from "../../../utils/create-artifact-union-helper";
import { CommonBinaryArtifact, CommonLibraryArtifact } from "../common/schema/artifact";
import { Target } from "../common/schema/index";
import { validateConfigReferences, validateOutputNameCollisions } from "../common/vaildations";

const Artifact = createArtifactUnionHelper(CommonBinaryArtifact, CommonLibraryArtifact);

const ReleaseSchema = z
  .object({
    strip: z.boolean().optional().default(true),
    lto: z.boolean().optional().default(true),
    codegenUnits: z.number().int().min(1).optional().default(1),
    panic: z.enum(["abort", "unwind"]).optional().default("abort"),
  })
  .strict();

/**
 * `refinery.toml` definition for `Rust` language.
 */
export const RustConfigSchema = z
  .object({
    artifacts: z.array(Artifact).optional().default([]),
    targets: z.array(Target).optional().default([]),
    release: ReleaseSchema.optional(),
  })
  .strict()
  .superRefine(validateConfigReferences)
  .superRefine(validateOutputNameCollisions);

export type RustRelease = z.infer<typeof ReleaseSchema>;

export const DEFAULT_RUST_RELEASE: RustRelease = {
  strip: true,
  lto: true,
  codegenUnits: 1,
  panic: "abort",
};
