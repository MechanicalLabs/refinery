import { z } from "zod";

export const RustConfigSchema = z
  .object({
    edition: z.string(),
  })
  .strict();

export type RustConfig = z.infer<typeof RustConfigSchema>;
