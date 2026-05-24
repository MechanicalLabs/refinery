import type { AsyncResult } from "ripthrow";
import type { z } from "zod";
import type { CommonBinaryArtifact, CommonLibraryArtifact } from "../lang/common/schema/artifact";
import type { RefineryConfig } from "../schema";
import type { LanguageCapabilities } from "../types/capabilities";

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
    }
  | {
      type: "composite";
      name?: string;
      action: string;
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
  features: string; // comma-separated, empty string if none
  defaultFeatures: boolean;
}

export interface TargetInfo {
  triple: string;
  os: string;
  arch: string;
  abi?: string;
  linker?: string;
  aptPackages: string[];
  linkerEnv?: Record<string, string>;
}

export interface LanguageStrategy {
  id: string;
  name: string;
  capabilities: LanguageCapabilities;
  configSchema: z.ZodTypeAny;
  /**
   * Returns the initial language-specific configuration for the manifest.
   */
  getInitialConfig: (projectName: string) => Partial<RefineryConfig>;
  /**
   * Performs side effects during initialization (e.g., creating files).
   */
  onInit: (ctx: StrategyContext) => AsyncResult<void, Error>;
  /**
   * Auto-detects project artifacts (e.g. from Cargo.toml, package.json).
   */
  detectArtifacts: (
    cwd: string,
  ) => AsyncResult<(CommonBinaryArtifact | CommonLibraryArtifact)[], Error>;
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
  /**
   * Resolves target info (triple, linker, apt packages) for a given os/arch/abi.
   */
  getTargetInfo: (os: string, arch: string, abi?: string) => TargetInfo | undefined;
  /**
   * Returns language-specific build environment variables (e.g. Rust release profiles).
   */
  getBuildEnv: (config: RefineryConfig) => Record<string, string>;

  /**
   * Returns the toolchain version string (e.g. "stable", "1.85.0", "20.x").
   * Reads from language-specific config fields; falls back to a sensible default.
   */
  getToolchainVersion: (config: RefineryConfig) => string;

  /**
   * Returns the list of binary tool names required locally (e.g. ["rustc", "cargo"]).
   */
  getRequiredTools: (config: RefineryConfig) => string[];

  /**
   * Validates that all required tools are available locally.
   * Called before build to fail fast on missing dependencies.
   */
  validateToolchain: (config: RefineryConfig) => AsyncResult<void, Error>;

  /**
   * Validates that the project's artifacts are consistent with the language's source.
   * Returns Ok if valid or if no validation is needed (e.g. Rust checks Cargo.toml).
   */
  validateArtifacts: (config: RefineryConfig) => AsyncResult<void, Error>;
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
