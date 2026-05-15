/**
 * Refinery `refinery.toml` schema definition.
 */

import { z } from "zod";
import { RustConfigSchema } from "./lang/rust/schema";

/**
 * LANG REGISTRIES
 *
 * NOTE: Must use `.extend()` (not manual shape spread) to preserve
 * `.superRefine()` calls from the language schema (collision detection, etc.).
 */
export const RefineryConfigSchema = z.discriminatedUnion("lang", [
  RustConfigSchema.extend({
    version: z.literal(1).describe("The version of the refinery configuration schema."),
    platform: z.enum(["github"]),
    lang: z.literal("rust"),
  }).strict(),
]);

export type RefineryConfig = z.infer<typeof RefineryConfigSchema>;
