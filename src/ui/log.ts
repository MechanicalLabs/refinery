/**
 * File for logging functions used in the CLI UI.
 * These functions are simple wrappers around console methods, allowing for consistent logging throughout the application and potential future enhancements.
 */

/** biome-ignore-all lint/suspicious/noConsole: Allowed because it's a logging function for CLI UI */

import pc from "picocolors";

import { DONE_ICON, ERROR_ICON, INFO_ICON, WARNING_ICON, withIcon } from "./icons";

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
};
