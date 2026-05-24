import { z } from "zod";
import { CommonBinaryTarget, CommonLibraryTarget } from "./target";

/**
 * --- TARGET TYPES ---
 */
export const Target = z.union([CommonBinaryTarget, CommonLibraryTarget]);
