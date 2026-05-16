// biome-ignore-all lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
import { parse } from "smol-toml";

export interface CrateInfo {
  packageName: string;
  binNames: string[];
  libNames: string[];
}

export function parseCargoToml(content: string): CrateInfo {
  const data = parse(content) as Record<string, unknown>;

  const pkg = data["package"] as Record<string, unknown> | undefined;
  const packageName = (pkg?.["name"] as string) ?? "";

  const binTables = data["bin"] as Record<string, unknown>[] | undefined;
  const binNames = binTables?.map((b) => String(b["name"])) ?? [];

  const libData = data["lib"];

  let libNames: string[] = [];

  if (Array.isArray(libData)) {
    libNames = libData.map((l) => String(l.name));
  } else if (typeof libData === "object" && libData !== null) {
    libNames = [String((libData as Record<string, unknown>)["name"])];
  }

  return { packageName, binNames, libNames };
}
