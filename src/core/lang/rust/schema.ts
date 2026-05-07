import { z } from "zod";

/**
 * `refinery.toml` definition for `Rust` language.
 */
export const RustConfigSchema = z
  .object({
    exampleProp: z.string(),
  })
  .strict();

export type RustConfig = z.infer<typeof RustConfigSchema>;
