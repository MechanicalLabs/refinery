import { z } from "zod";
import { NameSchema } from "./primitives";

/**
 * ##############
 * #  ARTIFACT  #
 * ##############
 */

/**
 * --- BINARY ---
 */
export const CommonBinaryArtifact = z
  .object({
    type: z.literal("bin"),
    name: NameSchema,
    outputName: z.string().min(1).optional(),
  })
  .strict();

/**
 * --- LIBRARY ---
 */
export const CommonLibraryArtifact = z
  .object({
    type: z.literal("lib"),
    name: NameSchema,
    headers: z.boolean().optional().default(false),
  })
  .strict();

export type CommonBinaryArtifact = z.infer<typeof CommonBinaryArtifact>;
export type CommonLibraryArtifact = z.infer<typeof CommonLibraryArtifact>;
