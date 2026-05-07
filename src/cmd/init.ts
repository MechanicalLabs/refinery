/**
 * Init command
 */

import { logger } from "../ui/log";
import type { Cmd } from ".";

function init(): void {
  logger.info("Initializing a new project...");
}

export const initCmd: Cmd = {
  name: "init",
  description: "Initialize a new project",
  action: init,
};
