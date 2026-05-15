import type { AsyncResult } from "ripthrow";
import type { RefineryConfig } from "../schema";

export interface StrategyContext {
  projectName: string;
  config: RefineryConfig;
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
