/** @swt-disable max-repetition */

import { z } from "zod";
import { createArtifactUnionHelper } from "../../../utils/create-artifact-union-helper";
import { enumFromObject } from "../../../utils/enum-from-object";
import { Abi } from "../../types/abi";
import { Arch } from "../../types/arch";
import { Os } from "../../types/os";
import { Package } from "../../types/packages";
import { validateBinaryTarget } from "./vaildations";

/**
 * ##############
 * #  ARTIFACT  #
 * ##############
 */

/**
 * --- BINARY ---
 */
export const CommonBinaryArtifact = z
  .object({
    type: z.literal("bin"),
    name: z.string().min(1, "Artifact name is required"),
    outputName: z.string().min(1).optional(),
  })
  .strict();

/**
 * --- LIBRARY ---
 */
export const CommonLibraryArtifact = z
  .object({
    type: z.literal("lib"),
    name: z.string().min(1, "Artifact name is required"),
    headers: z.boolean().optional().default(false),
  })
  .strict();

/**
 * --- ARTIFACT TYPES (z.infer) ---
 */
/** @lintignore */
export const Artifact = createArtifactUnionHelper(CommonBinaryArtifact, CommonLibraryArtifact);
/** @lintignore */
export type CommonBinaryArtifact = z.infer<typeof CommonBinaryArtifact>;
/** @lintignore */
export type CommonLibraryArtifact = z.infer<typeof CommonLibraryArtifact>;

// export type Artifact = z.infer<typeof Artifact>;

/**
 * ##############
 * #   TARGET   #
 * ##############
 */

/**
 * --- BINARY ---
 */
/* @lintignore */
export const CommonBinaryTarget = z
  .object({
    id: z.string().min(1, "Target ID is required"),
    for: z.string().min(1, "Target must point to an artifact name"),
    type: z.literal("bin"),
    os: enumFromObject(Os),
    arch: z
      .array(enumFromObject(Arch))
      .min(1)
      .refine((items) => new Set(items).size === items.length, {
        message: "Architectures must be unique",
      }),
    abi: enumFromObject(Abi),
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
  .superRefine(validateBinaryTarget);

/**
 * --- LIBRARY ---
 */
/* @lintignore */
export const CommonLibraryTarget = z
  .object({
    id: z.string().min(1, "Target ID is required"),
    for: z.string().min(1, "Target must point to an artifact name"),
    type: z.literal("lib"),
    os: enumFromObject(Os),
    arch: z
      .array(enumFromObject(Arch))
      .min(1)
      .refine((items) => new Set(items).size === items.length, {
        message: "Architectures must be unique",
      }),
    abi: enumFromObject(Abi),
    packages: z
      .array(enumFromObject(Package))
      .min(1)
      .refine((items) => new Set(items).size === items.length, {
        message: "Packages must be unique",
      })
      .optional(),
    headers: z.boolean().optional().default(false),
    includeInPackage: z
      .array(z.string())
      .min(1)
      .refine((items) => new Set(items).size === items.length, {
        message: "File to include in package must be unique",
      })
      .optional(),
  })
  .strict()
  .superRefine(validateBinaryTarget);

/**
 * --- TARGET TYPES (z.infer) ---
 */
export const Target = createArtifactUnionHelper(CommonBinaryTarget, CommonLibraryTarget);
/** @lintignore */
export type CommonBinaryTarget = z.infer<typeof CommonBinaryTarget>;
/** @lintignore */
export type CommonLibraryTarget = z.infer<typeof CommonLibraryTarget>;
