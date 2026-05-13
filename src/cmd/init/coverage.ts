import type {
  CommonBinaryArtifact,
  CommonLibraryArtifact,
} from "../../core/lang/common/schema/artifact";
import type { Arch } from "../../core/types/arch";
import { getCompatibleAbis, isAbiRequired } from "../../core/types/compatibility";
import { Os } from "../../core/types/os";

export const TOTAL_ARCHS = 4;
export type CoverageMap = Map<string, Set<string>>;

/**
 * Returns OS options that still have uncovered targets (ABIs/Archs)
 * for a specific artifact.
 */
export function getAvailableOsOptions(
  artifact: CommonBinaryArtifact | CommonLibraryArtifact,
  coverage: CoverageMap,
): { value: string; label: string }[] {
  const osOptions = [
    { value: Os.linux, label: "Linux" },
    { value: Os.macos, label: "macOS" },
    { value: Os.windows, label: "Windows" },
  ];

  return osOptions.filter((osOpt) => {
    if (!isAbiRequired(osOpt.value)) {
      const key = `${artifact.name}:${osOpt.value}:none`;
      const coveredArchs = coverage.get(key) ?? new Set();
      return coveredArchs.size < TOTAL_ARCHS;
    }

    const abis = getCompatibleAbis(osOpt.value);

    return abis.some((a) => {
      const key = `${artifact.name}:${osOpt.value}:${a}`;
      const coveredArchs = coverage.get(key) ?? new Set();
      return coveredArchs.size < TOTAL_ARCHS;
    });
  });
}

/**
 * Updates the coverage map with newly defined targets.
 */
export function updateCoverage(params: {
  artifactName: string;
  os: string;
  abi: string | undefined;
  archs: (keyof typeof Arch)[];
  coverage: CoverageMap;
}): void {
  const { artifactName, os, abi, archs, coverage } = params;
  let abiKey = "none";
  if (abi) {
    abiKey = abi;
  }
  const key = `${artifactName}:${os}:${abiKey}`;

  if (!coverage.has(key)) {
    coverage.set(key, new Set());
  }

  const archSet = coverage.get(key) as Set<string>;
  for (const a of archs) {
    archSet.add(a);
  }
}
