import { z } from "zod";
import { enumFromObject } from "../../../../utils/enum-from-object";
import { Abi } from "../../../types/abi";
import { Arch } from "../../../types/arch";
import { Os } from "../../../types/os";
import { Package } from "../../../types/packages";
import { validateBinaryTarget } from "../vaildations";
import { IdSchema, NameSchema, UniqueStringArraySchema } from "./primitives";

/**
 * ##############
 * #   TARGET   #
 * ##############
 */

const BaseTargetSchema = z.object({
  id: IdSchema,
  for: NameSchema,
  os: enumFromObject(Os),
  arch: z
    .array(enumFromObject(Arch))
    .min(1)
    .refine((items: string[]): boolean => new Set(items).size === items.length, {
      message: "Architectures must be unique",
    }),
  abi: enumFromObject(Abi).optional(),
  packages: z
    .array(enumFromObject(Package))
    .min(1)
    .refine((items: string[]): boolean => new Set(items).size === items.length, {
      message: "Packages must be unique",
    })
    .optional(),
  includeInPackage: UniqueStringArraySchema("File to include in package must be unique").optional(),
});

/**
 * --- BINARY ---
 */
export const CommonBinaryTarget = BaseTargetSchema.extend({
  type: z.literal("bin"),
})
  .strict()
  .superRefine(validateBinaryTarget);

/**
 * --- LIBRARY ---
 */
export const CommonLibraryTarget = BaseTargetSchema.extend({
  type: z.literal("lib"),
  headers: z.boolean().optional().default(false),
})
  .strict()
  .superRefine(validateBinaryTarget);

export type CommonBinaryTarget = z.infer<typeof CommonBinaryTarget>;
export type CommonLibraryTarget = z.infer<typeof CommonLibraryTarget>;
