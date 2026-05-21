import { z } from "zod";
import { RustConfigSchema } from "./lang/rust/schema";

const TargetsUnion = z.union([z.literal("once"), z.literal("all"), z.array(z.string())]).optional();

const CompositeStepSchema = z
  .object({
    type: z.literal("composite"),
    name: z.string().optional(),
    action: z.string(),
    with: z.record(z.string(), z.any()).optional(),
    secrets: z.array(z.string()).optional(),
    permissions: z.record(z.string(), z.string()).optional(),
    targets: TargetsUnion,
    enabled: z.boolean().optional(),
  })
  .strict();

const PreBuildBuiltinSchema = z
  .object({
    type: z.literal("builtin"),
    name: z.string().optional(),
    builtin: z.enum(["checkout", "setup_toolchain", "setup_linker"]),
    with: z.record(z.string(), z.any()).optional(),
    targets: TargetsUnion,
    enabled: z.boolean().optional(),
  })
  .strict();

const PreBuildStepSchema = z.discriminatedUnion("type", [
  PreBuildBuiltinSchema,
  CompositeStepSchema,
]);

const PostBuildBuiltinSchema = z
  .object({
    type: z.literal("builtin"),
    name: z.string().optional(),
    builtin: z.enum(["package", "upload_artifact"]),
    with: z.record(z.string(), z.any()).optional(),
    targets: TargetsUnion,
    enabled: z.boolean().optional(),
  })
  .strict();

const PostBuildStepSchema = z.discriminatedUnion("type", [
  PostBuildBuiltinSchema,
  CompositeStepSchema,
]);

const PublishBuiltinSchema = z
  .object({
    type: z.literal("builtin"),
    name: z.string().optional(),
    builtin: z.enum(["download_artifact", "github_release"]),
    with: z.record(z.string(), z.any()).optional(),
    targets: TargetsUnion,
    enabled: z.boolean().optional(),
  })
  .strict();

const PublishStepSchema = z.discriminatedUnion("type", [PublishBuiltinSchema, CompositeStepSchema]);

/**
 * LANG REGISTRIES
 *
 * NOTE: Must use `.extend()` (not manual shape spread) to preserve
 * `.superRefine()` calls from the language schema (collision detection, etc.).
 */
const RefineryConfigSchema = z.discriminatedUnion("lang", [
  RustConfigSchema.extend({
    version: z.literal(1).describe("The version of the refinery configuration schema."),
    platform: z.enum(["github"]),
    lang: z.literal("rust"),
    // biome-ignore lint/style/useNamingConvention: TOML key
    pre_build: z.array(PreBuildStepSchema).optional(),
    // biome-ignore lint/style/useNamingConvention: TOML key
    post_build: z.array(PostBuildStepSchema).optional(),
    publish: z.array(PublishStepSchema).optional(),
  }).strict(),
]);

type PreBuildStep = z.infer<typeof PreBuildStepSchema>;
type PostBuildStep = z.infer<typeof PostBuildStepSchema>;
type PublishStep = z.infer<typeof PublishStepSchema>;
type RefineryConfig = z.infer<typeof RefineryConfigSchema>;

export {
  type PostBuildStep,
  type PreBuildStep,
  type PublishStep,
  type RefineryConfig,
  RefineryConfigSchema,
};
