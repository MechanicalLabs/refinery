import { z } from "zod";
import { enumFromObject } from "../../../utils/enum-from-object";
import { Abi } from "../../types/abi";
import { Arch } from "../../types/arch";
import { Os } from "../../types/os";
import { Package } from "../../types/packages";

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

// export const Artifact = createArtifactSchema(CommonBinaryArtifact, CommonLibraryArtifact);
export type CommonBinaryArtifact = z.infer<typeof CommonBinaryArtifact>;
// export type CommonBinaryLibrary = z.infer<typeof CommonLibraryArtifact>;

// export type Artifact = z.infer<typeof Artifact>;

export const CommonBinaryTarget = z
  .object({
    type: z.literal("bin"),
    os: enumFromObject(Os),
    arch: z
      .array(enumFromObject(Arch))
      .min(1)
      .refine((items) => new Set(items).size === items.length, {
        message: "Architectures must be unique",
      }),
    abi: enumFromObject(Abi).optional(),
    packages: z
      .array(enumFromObject(Package))
      .min(1)
      .refine((items) => new Set(items).size === items.length, {
        message: "Packages must be unique",
      })
      .optional(),
    // For including files inside `.zip` or `.tar.gz` if neccesary.
    includeInPackage: z
      .array(z.string())
      .min(1)
      .refine((items) => new Set(items).size === items.length, {
        message: "File to include in package must be unique",
      })
      .optional(),
  })
  .strict()
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: High complexity is inherent to the strict target platform validation rules.
  .superRefine((data, ctx) => {
    if (data.os === Os.macos && data.abi) {
      ctx.addIssue({
        code: "custom",
        message: "MacOS does not support ABIs",
        path: ["abi"],
      });
    }

    if (data.os === Os.linux && data.abi) {
      const allowed: (typeof Abi)[keyof typeof Abi][] = [Abi.gnu, Abi.musl];
      if (!allowed.includes(data.abi)) {
        ctx.addIssue({
          code: "custom",
          message: "Linux only supports 'gnu' or 'musl'",
          path: ["abi"],
        });
      }
    }

    if (data.os === Os.windows && data.abi) {
      const allowed: (typeof Abi)[keyof typeof Abi][] = [Abi.gnu, Abi.msvc];
      if (!allowed.includes(data.abi)) {
        ctx.addIssue({
          code: "custom",
          message: "Windows only supports 'msvc' or 'gnu'",
          path: ["abi"],
        });
      }
    }

    if (data.packages) {
      if (
        data.os !== Os.linux &&
        (data.packages.includes(Package.deb) || data.packages.includes(Package.rpm))
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Linux-specific packages (deb/rpm) are not allowed for other OS",
          path: ["packages"],
        });
      }

      if (data.os !== Os.windows && data.packages.includes(Package.msi)) {
        ctx.addIssue({
          code: "custom",
          message: "MSI packages are only allowed for Windows",
          path: ["packages"],
        });
      }
    }
  })
  .transform((data) => {
    if (data.abi) {
      return data;
    }

    if (data.os === Os.linux) {
      return {
        ...data,
        abi: Abi.gnu,
      };
    }

    if (data.os === Os.windows) {
      return {
        ...data,
        abi: Abi.msvc,
      };
    }

    return data;
  });

export type CommonBinaryTarget = z.infer<typeof CommonBinaryTarget>;
