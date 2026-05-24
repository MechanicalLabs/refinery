import type { Abi } from "./abi";
import type { Arch } from "./arch";
import type { Os } from "./os";
import type { Package } from "./packages";

interface OsCapability {
  os: (typeof Os)[keyof typeof Os];
  archs: (typeof Arch)[keyof typeof Arch][];
  abis?: (typeof Abi)[keyof typeof Abi][];
}

export interface LanguageCapabilities {
  oses: (typeof Os)[keyof typeof Os][];
  archs: OsCapability[];
  packages: { os: string; packages: string[] }[];
  supportsLibraries: boolean;
  defaultPackages: (typeof Package)[keyof typeof Package][];
}
