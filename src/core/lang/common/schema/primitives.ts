import { z } from "zod";

/**
 * Common shared Zod primitives to ensure consistency and fail-fast behavior.
 */

export const NameSchema = z.string().min(1, "Name is required");

export const IdSchema = z.string().min(1, "ID is required");

export const UniqueStringArraySchema = (message: string): z.ZodType<string[]> =>
  z
    .array(z.string())
    .min(1)
    .refine((items: string[]): boolean => new Set(items).size === items.length, {
      message,
    });
