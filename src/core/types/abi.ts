export const Abi = {
  gnu: "gnu",
  musl: "musl",
  msvc: "msvc",
} as const;

// export type AbiType = (typeof Abi)[keyof typeof Abi];
