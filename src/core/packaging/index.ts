import { debPackager } from "./deb";
import { msiPackager } from "./msi";
import { rpmPackager } from "./rpm";
import type { Packager } from "./types";

export const PACKAGERS: Record<string, Packager> = {
  deb: debPackager,
  rpm: rpmPackager,
  msi: msiPackager,
};

export type { Packager, PackageStep } from "./types";
