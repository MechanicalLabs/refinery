// biome-ignore-all lint/style/useExportsLast: exported types and functions are used throughout
import type {
  CommonBinaryArtifact,
  CommonLibraryArtifact,
} from "../../core/lang/common/schema/artifact";
import type { LanguageCapabilities } from "../../core/types/capabilities";

export type CoverageMap = Map<string, Set<string>>;

/**
 * Returns OS options that still have at least one architecture available
 * for a specific artifact and language capabilities.
 */
export function getAvailableOsOptions(
  artifact: CommonBinaryArtifact | CommonLibraryArtifact,
  coverage: CoverageMap,
  caps: LanguageCapabilities,
): { value: string; label: string }[] {
  const osOptions = caps.oses.map((os) => ({
    value: os,
    label: os.charAt(0).toUpperCase() + os.slice(1),
  }));

  return osOptions.filter((osOpt) => {
    const osEntry = caps.archs.find((a) => a.os === osOpt.value);
    if (!osEntry) {
      return false;
    }

    const abis = osEntry.abis && osEntry.abis.length > 0 ? osEntry.abis : [undefined];
    return abis.some((a) => {
      const available = getAvailableArchs(artifact.name, osOpt.value, a, coverage, caps);
      return available.length > 0;
    });
  });
}

/**
 * Gets available ABIs for a given artifact, OS, and language capabilities.
 */
export function getAvailableAbis(
  artifactName: string,
  os: string,
  coverage: CoverageMap,
  caps: LanguageCapabilities,
): string[] {
  const osEntry = caps.archs.find((a) => a.os === os);
  if (!osEntry?.abis) {
    return [];
  }

  return osEntry.abis.filter((abi) => {
    const available = getAvailableArchs(artifactName, os, abi, coverage, caps);
    return available.length > 0;
  });
}

/**
 * Gets available architectures for a given artifact, OS, ABI, and language capabilities.
 */
function isWasmAlreadyCovered(artifactName: string, os: string, coverage: CoverageMap): boolean {
  return Array.from(coverage.entries()).some(
    ([k, v]) => k.startsWith(`${artifactName}:${os}:`) && v.has("wasm32"),
  );
}

export function getAvailableArchs(
  artifactName: string,
  os: string,
  abi: string | undefined,
  coverage: CoverageMap,
  caps: LanguageCapabilities,
): string[] {
  const osEntry = caps.archs.find((a) => a.os === os);
  if (!osEntry) {
    return [];
  }

  const abiKey = abi ?? "none";
  const key = `${artifactName}:${os}:${abiKey}`;
  const covered = coverage.get(key) ?? new Set();
  const wasmTaken = isWasmAlreadyCovered(artifactName, os, coverage);

  return osEntry.archs.filter((arch) => {
    if (arch === "wasm32" && wasmTaken) return false;
    return !covered.has(arch);
  });
}

/**
 * Updates the coverage map with newly defined targets.
 */
export function updateCoverage(params: {
  artifactName: string;
  os: string;
  abi: string | undefined;
  archs: string[];
  coverage: CoverageMap;
}): void {
  const { artifactName, os, abi, archs, coverage } = params;
  const abiKey = abi ?? "none";
  const key = `${artifactName}:${os}:${abiKey}`;

  if (!coverage.has(key)) {
    coverage.set(key, new Set());
  }

  const archSet = coverage.get(key) as Set<string>;
  for (const a of archs) {
    archSet.add(a);
  }

  if (archs.includes("wasm32")) {
    for (const [k, v] of coverage.entries()) {
      if (k.startsWith(`${artifactName}:${os}:`) && k !== key) {
        v.add("wasm32");
      }
    }
  }
}
