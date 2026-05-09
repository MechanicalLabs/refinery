export const Package = {
  msi: "msi",
  deb: "deb",
  rpm: "rpm",
  zip: "zip",
  // biome-ignore lint/style/useNamingConvention: it's a package name
  tar_gz: "tar.gz",
} as const;

// export type PackageType = (typeof Package)[keyof typeof Package];
