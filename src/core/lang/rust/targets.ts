// biome-ignore-all lint/style/useNamingConvention: Cargo env vars and triple names
// biome-ignore-all lint/style/useExportsLast: Data-heavy registry file

import type { TargetInfo } from "../../strategy/types";

const RUST_TARGETS: TargetInfo[] = [
  // --- LINUX ---
  {
    triple: "x86_64-unknown-linux-gnu",
    os: "linux",
    arch: "x86_64",
    abi: "gnu",
    aptPackages: [],
  },
  {
    triple: "x86_64-unknown-linux-musl",
    os: "linux",
    arch: "x86_64",
    abi: "musl",
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
    aptPackages: ["gcc-multilib"],
    linkerEnv: {
      CARGO_TARGET_I686_UNKNOWN_LINUX_GNU_LINKER: "gcc",
      RUSTFLAGS: "-C link-arg=-m32",
    },
  },
  {
    triple: "i686-unknown-linux-musl",
    os: "linux",
    arch: "x86",
    abi: "musl",
    aptPackages: ["gcc-multilib", "musl-tools"],
    linkerEnv: {
      CARGO_TARGET_I686_UNKNOWN_LINUX_MUSL_LINKER: "musl-gcc",
      RUSTFLAGS: "-C link-arg=-m32",
    },
  },
  {
    triple: "armv7-unknown-linux-gnueabihf",
    os: "linux",
    arch: "armv7",
    abi: "gnueabihf",
    linker: "arm-linux-gnueabihf-gcc",
    aptPackages: ["gcc-arm-linux-gnueabihf", "libc6-dev-armhf-cross"],
    linkerEnv: {
      CARGO_TARGET_ARMV7_UNKNOWN_LINUX_GNUEABIHF_LINKER: "arm-linux-gnueabihf-gcc",
    },
  },
  {
    triple: "armv7-unknown-linux-musleabihf",
    os: "linux",
    arch: "armv7",
    abi: "musl",
    linker: "arm-linux-gnueabihf-gcc",
    aptPackages: ["gcc-arm-linux-gnueabihf", "musl-tools"],
    linkerEnv: {
      CARGO_TARGET_ARMV7_UNKNOWN_LINUX_MUSLEABIHF_LINKER: "arm-linux-gnueabihf-gcc",
    },
  },
  {
    triple: "wasm32-unknown-unknown",
    os: "linux",
    arch: "wasm32",
    aptPackages: [],
  },

  // --- MACOS ---
  {
    triple: "x86_64-apple-darwin",
    os: "macos",
    arch: "x86_64",
    aptPackages: [],
  },
  {
    triple: "aarch64-apple-darwin",
    os: "macos",
    arch: "arm64",
    aptPackages: [],
  },
  {
    triple: "wasm32-unknown-unknown",
    os: "macos",
    arch: "wasm32",
    aptPackages: [],
  },

  // --- WINDOWS ---
  {
    triple: "x86_64-pc-windows-msvc",
    os: "windows",
    arch: "x86_64",
    abi: "msvc",
    aptPackages: [],
  },
  {
    triple: "x86_64-pc-windows-gnu",
    os: "windows",
    arch: "x86_64",
    abi: "gnu",
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
    aptPackages: [],
  },
  {
    triple: "i686-pc-windows-msvc",
    os: "windows",
    arch: "x86",
    abi: "msvc",
    aptPackages: [],
  },
  {
    triple: "i686-pc-windows-gnu",
    os: "windows",
    arch: "x86",
    abi: "gnu",
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
    aptPackages: [],
  },
];

export const RustTargets = {
  all: (): TargetInfo[] => RUST_TARGETS,

  find: (query: { os: string; arch: string; abi?: string | undefined }): TargetInfo | undefined =>
    RUST_TARGETS.find((t) => {
      const matchOs = t.os === query.os;
      const matchArch = t.arch === query.arch;
      const targetAbi = t.abi;
      let queryAbi = query.abi;
      if (query.os === "linux" && (queryAbi === "gnu" || queryAbi === "gnueabihf")) {
        queryAbi = undefined;
      }
      if (query.os === "windows" && queryAbi === "msvc") {
        queryAbi = undefined;
      }
      const normalizedTargetAbi =
        (t.os === "linux" && (targetAbi === "gnu" || targetAbi === "gnueabihf")) ||
        (t.os === "windows" && targetAbi === "msvc")
          ? undefined
          : targetAbi;
      const matchAbi = normalizedTargetAbi === queryAbi;
      return matchOs && matchArch && matchAbi;
    }),

  getByTriple: (triple: string, os?: string): TargetInfo | undefined =>
    RUST_TARGETS.find((t) => t.triple === triple && (os ? t.os === os : true)),
};
