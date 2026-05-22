// biome-ignore-all lint/style/useNamingConvention: Cargo env vars and triple names
// biome-ignore-all lint/style/useExportsLast: Data-heavy registry file

import type { Arch } from "../types/arch";
import type { Os } from "../types/os";

export interface TargetInfo {
  triple: string;
  os: (typeof Os)[keyof typeof Os];
  arch: (typeof Arch)[keyof typeof Arch];
  abi?: string;
  runsOn: string;
  linker?: string;
  aptPackages: string[];
  linkerEnv?: Record<string, string>;
}

const TARGETS: TargetInfo[] = [
  // --- LINUX ---
  {
    triple: "x86_64-unknown-linux-gnu",
    os: "linux",
    arch: "x86_64",
    abi: "gnu",
    runsOn: "ubuntu-latest",
    aptPackages: [],
  },
  {
    triple: "x86_64-unknown-linux-musl",
    os: "linux",
    arch: "x86_64",
    abi: "musl",
    runsOn: "ubuntu-latest",
    aptPackages: ["musl-tools"],
    linkerEnv: {
      CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_LINKER: "musl-gcc",
    },
  },
  {
    triple: "aarch64-unknown-linux-gnu",
    os: "linux",
    arch: "arm64",
    abi: "gnu",
    runsOn: "ubuntu-24.04-arm",
    linker: "aarch64-linux-gnu-gcc",
    aptPackages: ["gcc-aarch64-linux-gnu"],
    linkerEnv: {
      CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER: "aarch64-linux-gnu-gcc",
    },
  },
  {
    triple: "aarch64-unknown-linux-musl",
    os: "linux",
    arch: "arm64",
    abi: "musl",
    runsOn: "ubuntu-24.04-arm",
    linker: "aarch64-linux-gnu-gcc",
    aptPackages: ["gcc-aarch64-linux-gnu", "musl-tools"],
    linkerEnv: {
      CARGO_TARGET_AARCH64_UNKNOWN_LINUX_MUSL_LINKER: "aarch64-linux-gnu-gcc",
    },
  },
  {
    triple: "i686-unknown-linux-gnu",
    os: "linux",
    arch: "x86",
    abi: "gnu",
    runsOn: "ubuntu-latest",
    aptPackages: ["gcc-multilib"],
    linkerEnv: {
      CARGO_TARGET_I686_UNKNOWN_LINUX_GNU_LINKER: "gcc",
      RUSTFLAGS: "-C link-arg=-m32",
    },
  },
  {
    triple: "armv7-unknown-linux-gnueabihf",
    os: "linux",
    arch: "armv7",
    abi: "gnueabihf",
    runsOn: "ubuntu-latest",
    linker: "arm-linux-gnueabihf-gcc",
    aptPackages: ["gcc-arm-linux-gnueabihf"],
    linkerEnv: {
      CARGO_TARGET_ARMV7_UNKNOWN_LINUX_GNUEABIHF_LINKER: "arm-linux-gnueabihf-gcc",
    },
  },
  {
    triple: "wasm32-unknown-unknown",
    os: "linux",
    arch: "wasm32",
    runsOn: "ubuntu-latest",
    aptPackages: [],
  },

  // --- MACOS ---
  {
    triple: "x86_64-apple-darwin",
    os: "macos",
    arch: "x86_64",
    runsOn: "macos-latest",
    aptPackages: [],
  },
  {
    triple: "aarch64-apple-darwin",
    os: "macos",
    arch: "arm64",
    runsOn: "macos-latest",
    aptPackages: [],
  },
  {
    triple: "wasm32-unknown-unknown",
    os: "macos",
    arch: "wasm32",
    runsOn: "macos-latest",
    aptPackages: [],
  },

  // --- WINDOWS ---
  {
    triple: "x86_64-pc-windows-msvc",
    os: "windows",
    arch: "x86_64",
    abi: "msvc",
    runsOn: "windows-latest",
    aptPackages: [],
  },
  {
    triple: "x86_64-pc-windows-gnu",
    os: "windows",
    arch: "x86_64",
    abi: "gnu",
    runsOn: "windows-latest",
    linker: "x86_64-w64-mingw32-gcc",
    aptPackages: [],
    linkerEnv: {
      CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER: "x86_64-w64-mingw32-gcc",
    },
  },
  {
    triple: "aarch64-pc-windows-msvc",
    os: "windows",
    arch: "arm64",
    abi: "msvc",
    runsOn: "windows-11-arm",
    aptPackages: [],
  },
  {
    triple: "i686-pc-windows-msvc",
    os: "windows",
    arch: "x86",
    abi: "msvc",
    runsOn: "windows-latest",
    aptPackages: [],
  },
  {
    triple: "i686-pc-windows-gnu",
    os: "windows",
    arch: "x86",
    abi: "gnu",
    runsOn: "windows-latest",
    linker: "i686-w64-mingw32-gcc",
    aptPackages: [],
    linkerEnv: {
      CARGO_TARGET_I686_PC_WINDOWS_GNU_LINKER: "i686-w64-mingw32-gcc",
    },
  },
  {
    triple: "wasm32-unknown-unknown",
    os: "windows",
    arch: "wasm32",
    runsOn: "windows-latest",
    aptPackages: [],
  },
];

export const TargetRegistry = {
  all: () => TARGETS,

  find: (query: { os: string; arch: string; abi?: string | undefined }): TargetInfo | undefined => {
    return TARGETS.find((t) => {
      const matchOs = t.os === query.os;
      const matchArch = t.arch === query.arch;

      // Handle ABI normalization
      const targetAbi = t.abi;
      let queryAbi = query.abi;

      if (query.os === "linux" && queryAbi === "gnu") {
        queryAbi = undefined;
      }
      if (query.os === "windows" && queryAbi === "msvc") {
        queryAbi = undefined;
      }
      // targetAbi is already normalized in the constant but let's be safe
      const normalizedTargetAbi =
        (t.os === "linux" && targetAbi === "gnu") || (t.os === "windows" && targetAbi === "msvc")
          ? undefined
          : targetAbi;

      const matchAbi = normalizedTargetAbi === queryAbi;

      return matchOs && matchArch && matchAbi;
    });
  },

  getByTriple: (triple: string, os?: string): TargetInfo | undefined =>
    TARGETS.find((t) => t.triple === triple && (os ? t.os === os : true)),
};
