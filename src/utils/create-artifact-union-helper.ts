import { z } from "zod";

export const createArtifactUnionHelper = <
  B extends z.ZodObject<z.ZodRawShape & { type: z.ZodLiteral<"bin"> }>,
  L extends z.ZodObject<z.ZodRawShape & { type: z.ZodLiteral<"lib"> }>,
>(
  binary: B,
  library: L,
): z.ZodDiscriminatedUnion<[B, L], "type"> => z.discriminatedUnion("type", [binary, library]);
