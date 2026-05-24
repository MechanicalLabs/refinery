import pc from "picocolors";
import { type AsyncResult, Err, Ok } from "ripthrow";
import { Errors } from "../../errors";
import { logger } from "../../ui/log";
import { sh } from "../../utils/shell";
import type { LanguageStrategy, TargetMetadata } from "./types";

/**
 * Shared logic for managing local toolchains and system dependencies.
 */
export const LocalEnv = {
  /**
   * Checks if a required tool exists in the system's PATH.
   */
  async checkTool(name: string, command: string, silent = false): AsyncResult<void, Error> {
    const result = await sh`which ${command}`;
    if (result.ok && result.value.exitCode === 0) {
      if (!silent) {
        logger.done(`  ✓ ${name} found`);
      }
      return Ok();
    }
    if (!silent) {
      logger.fail(`  ✗ ${name} NOT found (${command})`);
    }
    return Err(Errors.toolMissing({ tool: name }));
  },

  /**
   * Installs and configures a specific toolchain version for a target triple.
   */
  async setupToolchain(triple: string, version?: string, dryRun = false): AsyncResult<void, Error> {
    const v = version && version !== "stable" ? version : "stable";

    if (dryRun) {
      logger.info(pc.dim(`  [dry-run] rustup toolchain install ${v}`));
      logger.info(pc.dim(`  [dry-run] rustup target add ${triple} --toolchain ${v}`));
      return Ok();
    }

    if (v !== "stable") {
      const installResult = await sh`rustup toolchain install ${v} --no-self-update`;
      if (!installResult.ok) {
        return Err(
          Errors.targetAdditionFailed({
            triple,
            reason: `Failed to install toolchain ${v}: ${installResult.error.message}`,
          }),
        );
      }
    }

    const cmd =
      v === "stable"
        ? `rustup target add ${triple}`
        : `rustup target add ${triple} --toolchain ${v}`;

    const result = await sh`${cmd}`;
    if (!result.ok) {
      return Err(Errors.targetAdditionFailed({ triple, reason: result.error.message }));
    }
    return Ok();
  },

  /**
   * Installs required system dependencies (e.g. via apt-get) for a given target.
   */
  async installSystemDeps(
    target: TargetMetadata,
    lang: LanguageStrategy,
    dryRun = false,
  ): AsyncResult<void, Error> {
    const targetInfo = lang.getTargetInfo(target.os, target.arch, target.abi);
    const apt = [...(targetInfo?.aptPackages ?? [])];

    if (target.packages.includes("rpm") && !apt.includes("rpm")) {
      apt.push("rpm");
    }

    if (apt.length === 0) {
      return Ok();
    }

    const cmd = `sudo apt-get update && sudo apt-get install -y ${apt.join(" ")}`;
    if (dryRun) {
      logger.info(pc.dim(`  [dry-run] ${cmd}`));
      return Ok();
    }

    const result = await sh`${cmd}`;
    if (!result.ok) {
      return Err(Errors.systemDepsInstallFailed({ reason: result.error.message }));
    }
    return Ok();
  },
};
