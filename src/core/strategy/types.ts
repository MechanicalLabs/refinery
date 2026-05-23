import type { AsyncResult } from "ripthrow";
import type { RefineryConfig } from "../schema";

export interface StrategyContext {
  projectName: string;
  config: RefineryConfig;
  lang: LanguageStrategy;
  cwd: string;
  sys: {
    sh: (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => AsyncResult<{ stdout: string; stderr: string; exitCode: number }, Error>;
    fs: {
      exists: (path: string) => AsyncResult<void, Error>;
      readFile: (path: string) => AsyncResult<string, Error>;
      writeFile: (path: string, content: string) => AsyncResult<number, Error>;
      mkdir: (path: string) => AsyncResult<void, Error>;
    };
  };
}

export type AbstractStep =
  | {
      type: "builtin";
      builtin:
        | "setup_toolchain"
        | "setup_linker"
        | "package"
        | "upload_artifact"
        | "checkout"
        | "install_tool";
      name?: string;
      with?: Record<string, string | number | boolean>;
      if?: string;
    }
  | {
      type: "shell";
      name: string;
      run: string;
      shell?: string;
      env?: Record<string, string>;
      if?: string;
    }
  | {
      type: "action";
      name: string;
      uses: string;
      with?: Record<string, string | number | boolean>;
      env?: Record<string, string>;
      if?: string;
    };

export interface TargetMetadata {
  artifact: string;
  artifactType: "bin" | "lib";
  os: string;
  arch: string;
  abi?: string | undefined;
  triple: string;
  outputName: string;
  packages: string[];
  includeFiles: string[];
  binExt: string;
  headers: boolean;
  linker?: string | undefined;
  artifactBin: string; // The binary name (e.g. underscored)
  aptPackages: string[];
}

export interface LanguageStrategy {
  id: string;
  name: string;
  /**
   * Returns the initial language-specific configuration for the manifest.
   */
  getInitialConfig: (projectName: string) => Partial<RefineryConfig>;
  /**
   * Performs side effects during initialization (e.g., creating files).
   */
  onInit: (ctx: StrategyContext) => AsyncResult<void, Error>;
  /**
   * Returns steps to set up the environment (toolchains, linkers, etc).
   */
  getSetupSteps: (ctx: StrategyContext, target: TargetMetadata) => AbstractStep[];
  /**
   * Returns steps to perform the actual build/compilation.
   */
  getBuildSteps: (ctx: StrategyContext, target: TargetMetadata) => AbstractStep[];
  /**
   * Returns steps to package and export artifacts.
   */
  getExportSteps: (ctx: StrategyContext, target: TargetMetadata) => AbstractStep[];
}

export interface PlatformStrategy {
  id: string;
  name: string;
  /**
   * Performs side effects during initialization (e.g., creating CI/CD files).
   */
  onInit: (ctx: StrategyContext) => AsyncResult<void, Error>;
  /**
   * Syncs the refinery.toml manifest to the platform's CI configuration.
   */
  migrate: (ctx: StrategyContext) => AsyncResult<void, Error>;
}
