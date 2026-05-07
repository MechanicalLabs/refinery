import { printBranding } from "./ui";
import { logger } from "./ui/log";

printBranding();

logger.info("This is a test");
logger.error("Something happened...");
logger.warn("This is a warning");
logger.done("All done!");
logger.suggestion("Try running 'refinery --help' for more information.");
