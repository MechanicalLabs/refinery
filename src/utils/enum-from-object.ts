import { z } from "zod";

export const enumFromObject = <T extends string>(
  obj: Record<string, T>,
): z.ZodEnum<z.util.ToEnum<T>> => {
  const values = Object.values(obj) as [T, ...T[]];

  return z.enum(values);
};
