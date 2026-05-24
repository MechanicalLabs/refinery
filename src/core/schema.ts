import { z } from "zod";
import { createArtifactUnionHelper } from "../utils/create-artifact-union-helper";
import { CommonBinaryArtifact, CommonLibraryArtifact } from "./lang/common/schema/artifact";
import { Target } from "./lang/common/schema/index";
import { validateConfigReferences } from "./lang/common/vaildations";

const Artifact = createArtifactUnionHelper(CommonBinaryArtifact, CommonLibraryArtifact);

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
 * Base config schema shared across all languages.
 * Language-specific fields are validated separately via each strategy's configSchema.
 */
export const BaseConfigSchema = z
  .object({
    version: z.literal(1).describe("The version of the refinery configuration schema."),
    platform: z.enum(["github"]),
    lang: z.string(),
    artifacts: z.array(Artifact).optional().default([]),
    targets: z.array(Target).optional().default([]),
    // biome-ignore lint/style/useNamingConvention: TOML key
    pre_build: z.array(PreBuildStepSchema).optional(),
    // biome-ignore lint/style/useNamingConvention: TOML key
    post_build: z.array(PostBuildStepSchema).optional(),
    publish: z.array(PublishStepSchema).optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    validateConfigReferences(data as Parameters<typeof validateConfigReferences>[0], ctx);
  });

/**
 * RefineryConfig is the union of BaseConfig with language-specific extensions.
 * The exact shape depends on the lang field, resolved at runtime via LanguageRegistry.
 */
export type PreBuildStep = z.infer<typeof PreBuildStepSchema>;
export type PostBuildStep = z.infer<typeof PostBuildStepSchema>;
export type PublishStep = z.infer<typeof PublishStepSchema>;
export type RefineryConfig = z.infer<typeof BaseConfigSchema> & Record<string, unknown>;
