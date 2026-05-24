import { Abi } from "../../types/abi";
import { Arch } from "../../types/arch";
import type { LanguageCapabilities } from "../../types/capabilities";
import { Os } from "../../types/os";
import { Package } from "../../types/packages";

export const RUST_CAPABILITIES: LanguageCapabilities = {
  oses: [Os.linux, Os.macos, Os.windows],
  archs: [
    {
      os: Os.linux,
      archs: [Arch.x86_64, Arch.x86, Arch.arm64, Arch.armv7, Arch.wasm32],
      abis: [Abi.gnu, Abi.musl],
    },
    { os: Os.macos, archs: [Arch.x86_64, Arch.arm64, Arch.wasm32] },
    {
      os: Os.windows,
      archs: [Arch.x86_64, Arch.x86, Arch.arm64, Arch.wasm32],
      abis: [Abi.msvc, Abi.gnu],
    },
  ],
  packages: [
    { os: Os.linux, packages: [Package.bin, Package.tar_gz, Package.deb, Package.rpm] },
    { os: Os.macos, packages: [Package.bin, Package.tar_gz] },
    { os: Os.windows, packages: [Package.bin, Package.zip, Package.msi] },
  ],
  supportsLibraries: true,
  defaultPackages: [Package.bin, Package.tar_gz],
};
