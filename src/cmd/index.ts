/**
 * The entry point for the CLI application.
 * This file sets up the command-line interface using the `commander` library and defines the available commands and their actions.
 */

import { Command } from "commander";

import pkg from "../../package.json" with { type: "json" };
import { printBranding } from "../ui";
import { initCmd } from "./init";

/**
 * Commander initialization
 */
const program = new Command();

interface Cmd {
  name: string;
  description: string;
  action: () => void;
}

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
 * COMMAND REGISTRY
 */
const commands: Cmd[] = [initCmd];

/**
 * Register commands with the commander program.
 */
for (const cmd of commands) {
  program
    .command(cmd.name)
    .description(cmd.description)
    .action(() => {
      cmd.action();
    });
}

export type { Cmd };
export { program };
