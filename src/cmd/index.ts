/**
 * The entry point for the CLI application.
 * This file sets up the command-line interface using the `commander` library.
 */

import { Command } from "commander";
import { getMeta } from "../macros.ts" with { type: "macro" };
import { printBranding } from "../ui";
import { CommandRegistry } from "./registry";

/**
 * Commander initialization
 */
const program = new Command();

/**
 * Define the program's name, description, version, and default action when no command is provided.
 */
program
  .name("refinery")
  .description("Configuration-driven CI/CD Orchestrator")
  .version(getMeta().version)
  .action(() => {
    printBranding();
    program.help();
  });

/**
 * Register commands from the CommandRegistry.
 */
for (const cmd of CommandRegistry.all()) {
  const sub = program.command(cmd.id).description(cmd.description);

  if (cmd.options) {
    for (const opt of cmd.options) {
      sub.option(opt.flags, opt.description);
    }
  }

  sub.action((options) => {
    cmd.action(options ?? {});
  });
}

export { program };
