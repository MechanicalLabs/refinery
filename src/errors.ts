import { createErrors } from "ripthrow";

export const Errors = createErrors({
  ioFileNotFound: { message: () => "File not found" },
  projectNameRequired: { message: () => "Name is required" },
  projectNameInvalid: {
    message: () => "Name can only contain letters, numbers, dashes, and underscores",
  },
  manifestAlreadyExists: { message: () => "A refinery.toml already exists" },
});

export type AppError = typeof Errors._type;
