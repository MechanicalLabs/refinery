import { createErrors } from "ripthrow";

export const Errors = createErrors({
  ioFileNotFound: { message: () => "File not found" },
  projectNameRequired: { message: () => "Name is required" },
  projectNameInvalid: {
    message: () => "Name can only contain letters, numbers, dashes, and underscores",
  },
  manifestAlreadyExists: {
    message: () => "A refinery.toml already exists",
    help: () => "Use --force to overwrite the existing file",
  },
  invalidStrategy: {
    message: (args: { strategy: string }) => `Invalid strategy: ${args.strategy}`,
  },
  strategyInitFailed: {
    message: (args: { strategy: string }) => `Failed to initialize ${args.strategy} strategy`,
  },
});

export type AppError = typeof Errors._type;
