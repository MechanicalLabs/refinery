// biome-ignore-all lint/style/useNamingConvention: cargo env vars
// biome-ignore-all lint/style/useExportsLast: interface must be defined before usage
export interface LinkerConfig {
  aptPackages: string[];
  linkerEnv: Record<string, string>;
}

const LINKER_CONFIGS: Record<string, LinkerConfig> = {
  "armv7-unknown-linux-gnueabihf": {
    aptPackages: ["gcc-arm-linux-gnueabihf"],
    linkerEnv: {
      CARGO_TARGET_ARMV7_UNKNOWN_LINUX_GNUEABIHF_LINKER: "arm-linux-gnueabihf-gcc",
    },
  },
  "aarch64-unknown-linux-gnu": {
    aptPackages: ["gcc-aarch64-linux-gnu"],
    linkerEnv: {
      CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER: "aarch64-linux-gnu-gcc",
    },
  },
  "aarch64-unknown-linux-musl": {
    aptPackages: ["gcc-aarch64-linux-gnu", "musl-tools"],
    linkerEnv: {
      CARGO_TARGET_AARCH64_UNKNOWN_LINUX_MUSL_LINKER: "aarch64-linux-gnu-gcc",
    },
  },
  "x86_64-unknown-linux-musl": {
    aptPackages: ["musl-tools"],
    linkerEnv: {
      CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_LINKER: "musl-gcc",
    },
  },
  "i686-unknown-linux-gnu": {
    aptPackages: ["gcc-multilib"],
    linkerEnv: {
      CARGO_TARGET_I686_UNKNOWN_LINUX_GNU_LINKER: "gcc",
      RUSTFLAGS: "-C link-arg=-m32",
    },
  },
  "i686-unknown-linux-musl": {
    aptPackages: ["musl-tools", "gcc-multilib"],
    linkerEnv: {
      CARGO_TARGET_I686_UNKNOWN_LINUX_MUSL_LINKER: "musl-gcc",
      RUSTFLAGS: "-C link-arg=-m32",
    },
  },
  "i686-pc-windows-gnu": {
    aptPackages: [],
    linkerEnv: {
      CARGO_TARGET_I686_PC_WINDOWS_GNU_LINKER: "i686-w64-mingw32-gcc",
    },
  },
  "x86_64-pc-windows-gnu": {
    aptPackages: [],
    linkerEnv: {
      CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER: "x86_64-w64-mingw32-gcc",
    },
  },
};

export function getLinkerConfig(triple: string): LinkerConfig | undefined {
  return LINKER_CONFIGS[triple];
}

export function getAptPackages(triple: string, packages: string[]): string[] {
  const apt: string[] = [];

  if (triple.includes("musl")) {
    apt.push("musl-tools");
  }
  if (triple.startsWith("i686") && !triple.includes("windows")) {
    apt.push("gcc-multilib");
  }
  if (triple.startsWith("armv7")) {
    apt.push("gcc-arm-linux-gnueabihf");
  }
  if (triple.startsWith("aarch64")) {
    apt.push("gcc-aarch64-linux-gnu");
  }
  if (packages.includes("rpm")) {
    apt.push("rpm");
  }

  return apt;
}
