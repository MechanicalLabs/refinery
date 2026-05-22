/**
 * The entry point for the CLI application.
 * This file sets up the command-line interface using the `commander` library.
 */

import { Command } from "commander";
import { getMeta } from "../macros.ts" with { type: "macro" };
import { printBranding } from "../ui";
import { logger } from "../ui/log";
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

  sub.action(async (options) => {
    const actionResult = cmd.action(options ?? {});

    if (
      actionResult instanceof Promise ||
      (actionResult !== null &&
        typeof actionResult === "object" &&
        "then" in (actionResult as unknown as object))
    ) {
      const result = await actionResult;

      // Handle ripthrow Result/AsyncResult
      if (result && typeof result === "object" && "ok" in result && !result.ok) {
        const err = result.error as any;
        logger.fail(err);

        // Print contextual notes if available (Report type)
        if (err.notes && Array.isArray(err.notes) && err.notes.length > 0) {
          for (const note of err.notes) {
            logger.info(`  └ ${note}`);
          }
        }

        // Print help text if available
        if (err.help) {
          logger.info(`\nHelp: ${err.help()}`);
        }

        process.exit(1);
      }
    }
  });
}

export { program };
