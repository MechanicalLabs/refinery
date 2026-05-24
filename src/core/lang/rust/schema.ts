import { z } from "zod";

const ReleaseSchema = z
  .object({
    strip: z.boolean().optional().default(true),
    lto: z.boolean().optional().default(true),
    codegenUnits: z.number().int().min(1).optional().default(1),
    panic: z.enum(["abort", "unwind"]).optional().default("abort"),
  })
  .strict();

/**
 * Rust-specific config schema (extends BaseConfigSchema at registration time).
 */
export const RustConfigSchema = z.object({
  lang: z.literal("rust"),
  release: ReleaseSchema.optional(),
  toolchain: z.string().optional().default("stable"),
});
