import { z } from "zod";

export const RustConfigSchema = z.object({
  lang: z.literal("rust"),
  toolchain: z.string().optional().default("stable"),
});
