export const Arch = {
  // biome-ignore lint/style/useNamingConvention: Disabled because it's an architecture name
  x86_64: "x86_64",
  x86: "x86",
  arm64: "arm64",
  armv7: "armv7",
  wasm32: "wasm32",
} as const;

// export type ArchType = (typeof Arch)[keyof typeof Arch];
