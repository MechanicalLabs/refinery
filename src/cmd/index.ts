import { Command } from "commander";

import pkg from "../../package.json" with { type: "json" };
import { printBranding } from "../ui";
import { logger } from "../ui/log";

const program = new Command();

program
  .name("refinery")
  .description("Configuration-driven CI/CD Orchestrator Orchestrator")
  .version(pkg.version)
  .action(() => {
    printBranding();

    program.help();
  });

program
  .command("example")
  .description("Example command")
  .action(() => {
    logger.info("This is an example command");
  });

export { program };
