import { z } from "zod";

export const CommonBinaryArtifact = z
  .object({
    type: z.literal("bin"),
    name: z.string(),
    outputName: z.string().optional(),
  })
  .strict();

export const CommonLibraryArtifact = z
  .object({
    type: z.literal("lib"),
    name: z.string(),
    headers: z.boolean().optional().default(false),
  })
  .strict();

export const createArtifactSchema = <
  B extends z.ZodObject<z.ZodRawShape & { type: z.ZodLiteral<"bin"> }>,
  L extends z.ZodObject<z.ZodRawShape & { type: z.ZodLiteral<"lib"> }>,
>(
  binary: B,
  library: L,
): z.ZodDiscriminatedUnion<[B, L], "type"> => z.discriminatedUnion("type", [binary, library]);

export const Artifact = createArtifactSchema(CommonBinaryArtifact, CommonLibraryArtifact);

export type Artifact = z.infer<typeof Artifact>;
