/**
 * File for UI-related functions and components used in the CLI application.
 */

import pc from "picocolors";
import { logger } from "./log";

/**
 * ASCII art for the Refinery branding, displayed when the CLI application starts.
 */
const REFINERY_ASCII = `
              _____
   ________  / __(_)___  ___  _______  __
  / ___/ _ \\/ /_/ / __ \\/ _ \\/ ___/ / / /
 / /  /  __/ __/ / / / /  __/ /  / /_/ /
/_/   \\___/_/ /_/_/ /_/\\___/_/   \\__, /
                                /____/
`;

/**
 * Prints the Refinery branding ASCII art to the console in red color.
 */
export function printBranding(): void {
  logger.print(pc.red(REFINERY_ASCII));
}
