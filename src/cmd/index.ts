/**
 * The entry point for the CLI application.
 * This file sets up the command-line interface using the `commander` library and defines the available commands and their actions.
 */

import { Command } from "commander";

import { getMeta } from "../macros.ts" with { type: "macro" };
import { printBranding } from "../ui";
import { initCmd } from "./init";

/**
 * Commander initialization
 */
const program = new Command();

interface CmdOption {
  flags: string;
  description: string;
}

interface Cmd {
  name: string;
  description: string;
  options?: CmdOption[];
  action: (options: Record<string, unknown>) => void;
}

/**
 * Define the program's name, description, version, and default action when no command is provided.
 */
program
  .name("refinery")
  .description("Configuration-driven CI/CD Orchestrator Orchestrator")
  .version(getMeta().version)
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
  const sub = program.command(cmd.name).description(cmd.description);

  if (cmd.options) {
    for (const opt of cmd.options) {
      sub.option(opt.flags, opt.description);
    }
  }

  sub.action((options) => {
    cmd.action(options ?? {});
  });
}

export type { Cmd };
export { program };
