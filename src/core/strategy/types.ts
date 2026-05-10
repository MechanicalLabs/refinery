import type { AsyncResult } from "ripthrow";
import type { RefineryConfig } from "../schema";

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
  onInit: (projectName: string) => AsyncResult<void, Error>;
}

export interface PlatformStrategy {
  id: string;
  name: string;
  /**
   * Performs side effects during initialization (e.g., creating CI/CD files).
   */
  onInit: (projectName: string) => AsyncResult<void, Error>;
}
