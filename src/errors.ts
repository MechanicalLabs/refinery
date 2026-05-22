import { createErrors } from "ripthrow";

export const Errors = createErrors({
  ioFileNotFound: {
    message: (args: { path: string }) => `File not found: '${args.path}'`,
  },
  manifestNotFound: {
    message: () => "refinery.toml not found",
    help: () => "Run 'refinery init' to create a refinery.toml",
  },
  projectNameRequired: { message: () => "Name is required" },
  projectNameInvalid: {
    message: () => "Name can only contain lowercase letters, numbers, and hyphens",
  },
  manifestAlreadyExists: {
    message: () => "A refinery.toml already exists",
    help: () => "Use --force to overwrite the existing file",
  },
  missingTargetFile: {
    message: (args: { file: string; targetId: string }) =>
      `File not found: '${args.file}' for target '${args.targetId}'`,
    help: () =>
      "Please ensure the file exists or remove it from 'includeInPackage' in refinery.toml",
  },
  invalidStrategy: {
    message: (args: { strategy: string }) => `Invalid strategy: ${args.strategy}`,
  },
  strategyInitFailed: {
    message: (args: { strategy: string }) => `Failed to initialize ${args.strategy} strategy`,
  },
  targetAdditionFailed: {
    message: (args: { triple: string; reason: string }) =>
      `Failed to add target ${args.triple}: ${args.reason}`,
    help: () => "Ensure 'rustup' is installed and you have internet access.",
  },
  systemDepsInstallFailed: {
    message: (args: { reason: string }) => `Failed to install system dependencies: ${args.reason}`,
    help: () => "Check your sudo permissions and apt-get configuration.",
  },
  stepExecutionFailed: {
    message: (args: { step: string; reason: string }) =>
      `Step '${args.step}' failed: ${args.reason}`,
  },
  targetNotFound: {
    message: (args: { targetId: string }) => `Target '${args.targetId}' not found`,
    help: () => "Verify that the target ID is defined in your refinery.toml.",
  },
  noTargetsDefined: {
    message: () => "No build targets defined",
    help: () => "Add at least one target to your refinery.toml.",
  },
  artifactValidationFailed: {
    message: (args: { reason: string }) => `Artifact validation failed: ${args.reason}`,
  },
  compositeActionNotFound: {
    message: (args: { name: string }) =>
      `Composite action '${args.name}' not found in .github/actions/`,
  },
  compositeActionReadFailed: {
    message: (args: { path: string; reason: string }) =>
      `Failed to read composite action at ${args.path}: ${args.reason}`,
  },
  compositeActionParseFailed: {
    message: (args: { path: string; reason: string }) =>
      `Failed to parse composite action YAML at ${args.path}: ${args.reason}`,
  },
  invalidCompositeAction: {
    message: (args: { path: string }) => `Action at ${args.path} is not a valid composite action`,
  },
  validationError: {
    message: (args: { reason: string }) => `Configuration validation failed: ${args.reason}`,
  },
});

export type AppError = typeof Errors._type;
