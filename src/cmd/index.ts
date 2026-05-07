/**
 * The entry point for the CLI application.
 * This file sets up the command-line interface using the `commander` library and defines the available commands and their actions.
 */

import { Command } from "commander";

import pkg from "../../package.json" with { type: "json" };
import { printBranding } from "../ui";
import { logger } from "../ui/log";

/**
 * Commander initialization
 */
const program = new Command();

/**
 * Define the program's name, description, version, and default action when no command is provided.
 */
program
  .name("refinery")
  .description("Configuration-driven CI/CD Orchestrator Orchestrator")
  .version(pkg.version)
  .action(() => {
    printBranding();

    program.help();
  });

/**
 * Example command.
 * TODO: delete this
 */
program
  .command("example")
  .description("Example command")
  .action(() => {
    logger.info("This is an example command");
  });

export { program };
