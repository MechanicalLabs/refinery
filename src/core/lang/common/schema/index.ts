import { createArtifactUnionHelper } from "../../../../utils/create-artifact-union-helper";
import { CommonBinaryTarget, CommonLibraryTarget } from "./target";

/**
 * --- TARGET TYPES ---
 */
export const Target = createArtifactUnionHelper(CommonBinaryTarget, CommonLibraryTarget);
