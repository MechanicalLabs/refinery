import { z } from "zod";
import { NameSchema } from "./primitives";

/**
 * ##############
 * #  ARTIFACT  #
 * ##############
 */

const FeatureFields = {
  features: z.array(z.string()).optional(),
  defaultFeatures: z.boolean().optional(),
} as const;

/**
 * --- BINARY ---
 */
export const CommonBinaryArtifact = z
  .object({
    type: z.literal("bin"),
    name: NameSchema,
    outputName: z.string().min(1).optional(),
    ...FeatureFields,
  })
  .strict();

/**
 * --- LIBRARY ---
 */
export const CommonLibraryArtifact = z
  .object({
    type: z.literal("lib"),
    name: NameSchema,
    outputName: z.string().min(1).optional(),
    headers: z.boolean().optional().default(false),
    ...FeatureFields,
  })
  .strict();

export type CommonBinaryArtifact = z.infer<typeof CommonBinaryArtifact>;
export type CommonLibraryArtifact = z.infer<typeof CommonLibraryArtifact>;
