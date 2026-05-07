import pkg from "../package.json" with { type: "json" };

export interface ProjectMetadata {
  version: string;
  name: string;
}

export function getMeta(): ProjectMetadata {
  return {
    version: pkg.version,
    name: pkg.name,
  };
}
