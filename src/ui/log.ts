/**
 * File for logging functions used in the CLI UI.
 * These functions are simple wrappers around console methods, allowing for consistent logging throughout the application and potential future enhancements.
 */

/** biome-ignore-all lint/suspicious/noConsole: Allowed because it's a logging function for CLI UI */

import pc from "picocolors";

import { DONE_ICON, ERROR_ICON, INFO_ICON, WARNING_ICON, withIcon } from "./icons";

// @ts-expect-error noImplicitReturns: biome strips the trailing return undefined
function getHelp(err: unknown): string | undefined {
  if (err && typeof err === "object" && "help" in err) {
    const { help } = err as { help?: unknown };
    if (typeof help === "string" && help.length > 0) {
      return help;
    }
  }
}

export const logger = {
  print(...args: unknown[]): void {
    console.log(...args);
  },

  error(...args: unknown[]): void {
    console.error(withIcon(ERROR_ICON, ...args));
  },

  warn(...args: unknown[]): void {
    console.warn(withIcon(WARNING_ICON, ...args));
  },

  info(...args: unknown[]): void {
    console.info(withIcon(INFO_ICON, ...args));
  },

  done(...args: unknown[]): void {
    console.log(withIcon(DONE_ICON, ...args));
  },

  suggestion(...args: unknown[]): void {
    console.log(withIcon(INFO_ICON, pc.dim(args.join(" "))));
  },

  fail(err: unknown, ...extra: unknown[]): void {
    if (err instanceof Error) {
      logger.error(err.message, ...extra);
    } else {
      logger.error(String(err), ...extra);
    }

    const help = getHelp(err);
    if (help) {
      console.log(withIcon(INFO_ICON, pc.cyan(help)));
    }
  },
};
