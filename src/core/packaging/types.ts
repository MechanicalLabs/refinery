export interface PackageStep {
  name: string;
  run?: string;
  uses?: string;
  ifCondition: string;
  shell?: string;
  linker?: string;
  with?: Record<string, string>;
}

export interface Packager {
  id: string;
  condition: string;
  setupSteps: PackageStep[];
  buildSteps: PackageStep[];
}
