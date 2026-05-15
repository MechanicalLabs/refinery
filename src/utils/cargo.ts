import { parse } from "smol-toml";

export interface CrateInfo {
  packageName: string;
  binNames: string[];
  libNames: string[];
}

export function parseCargoToml(content: string): CrateInfo {
  const data = parse(content) as Record<string, unknown>;

  // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature
  const pkg = data["package"] as Record<string, unknown> | undefined;
  // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature
  const packageName = (pkg?.["name"] as string) ?? "";

  // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature
  const binTables = data["bin"] as Record<string, unknown>[] | undefined;
  const binNames =
    binTables?.map((b) => {
      // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature
      return String(b["name"]);
    }) ?? [];

  // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature
  const libData = data["lib"];
  let libNames: string[] = [];
  if (Array.isArray(libData)) {
    libNames = libData.map((l) => String(l.name));
  } else if (typeof libData === "object" && libData !== null) {
    // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature
    libNames = [String((libData as Record<string, unknown>)["name"])];
  }

  return { packageName, binNames, libNames };
}
