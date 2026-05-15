/* @lintignore */

/**
 * Single source of truth for GitHub Action versions used across generated workflows.
 *
 * This file is auto-updated by .github/workflows/update-constants.yml.
 * That workflow runs weekly and bumps versions based on semver scope:
 *   @v4       (0 dots) → any major bump (v4 → v5)
 *   @v5.0     (1 dot)  → minor bump within major (v5.0 → v5.x)
 *   @v5.0.1   (2 dots) → patch bump within minor (v5.0.1 → v5.0.x)
 *
 * Usage:
 *   import { Actions } from "./constants";
 *   const step = { uses: Actions.checkout };
 *
 *   The _TRACKED_ACTIONS list below is the canonical reference for which
 *   repos the update workflow tracks. Keep update-constants.yml in sync.
 *
 *   _TRACKED_ACTIONS = [
 *     "actions/checkout",
 *     "actions/upload-artifact",
 *     "actions/download-artifact",
 *     "softprops/action-gh-release",
 *     "peter-evans/create-pull-request",
 *     "actions-rust-lang/setup-rust-toolchain",
 *   ]
 *
 *   _CONSTANTS_FILE_PATH = "src/core/platforms/github/constants.ts"
 */

export const Actions = {
  checkout: "actions/checkout@v4",
  setupRust: "actions-rust-lang/setup-rust-toolchain@v1",
  uploadArtifact: "actions/upload-artifact@v4",
  downloadArtifact: "actions/download-artifact@v4",
  ghRelease: "softprops/action-gh-release@v2",
  createPullRequest: "peter-evans/create-pull-request@v7",
} as const;
