import { createArtifactUnionHelper } from "../../../../utils/create-artifact-union-helper";
import { CommonBinaryTarget, CommonLibraryTarget } from "./target";

/**
 * --- ARTIFACT TYPES ---
 */
// export const Artifact = createArtifactUnionHelper(CommonBinaryArtifact, CommonLibraryArtifact);

/**
 * --- TARGET TYPES ---
 */
export const Target = createArtifactUnionHelper(CommonBinaryTarget, CommonLibraryTarget);
