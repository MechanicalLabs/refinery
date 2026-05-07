/**
 * Refinery `refinery.toml` schema definition.
 */

import { z } from "zod";
import { RustConfigSchema } from "./lang/rust/schema";

const baseShape = {
  version: z.number().describe("The version of the refinery configuration schema."),
  platform: z.enum(["github"]),
};

type BaseShape = typeof baseShape;

/**
 * Register helper function to register language schemas.
 */
function registerLang<T extends z.ZodRawShape, L extends string>(
  schema: z.ZodObject<T>,
  lang: L,
): z.ZodObject<BaseShape & { lang: z.ZodLiteral<L> } & T> {
  return z
    .object({
      ...baseShape,
      lang: z.literal(lang),
      ...schema.shape,
    })
    .strict() as z.ZodObject<BaseShape & { lang: z.ZodLiteral<L> } & T>;
}

/**
 * LANG REGISTRIES
 */
export const RefineryConfigSchema = z.discriminatedUnion("lang", [
  registerLang(RustConfigSchema, "rust"),
]);

export type RefineryConfig = z.infer<typeof RefineryConfigSchema>;
