# Architecture

Refinery is built as a modular orchestrator that decouples build logic from execution environments.

## System Components

### Command Registry
The CLI entry point uses a registry-based system to manage commands. Each command implements a standard interface, allowing for consistent error handling and option parsing.

### IO Layer
The `core/io` module abstracts filesystem operations and manifest handling. It uses `smol-toml` for parsing and `zod` for strict schema validation of the `refinery.toml` file.

### Strategy Pattern
The core logic is divided into two primary strategy types:

#### Language Strategy
Defines how to build software for a specific programming language.
- `getSetupSteps()`: Returns steps to prepare the compiler/toolchain.
- `getBuildSteps()`: Returns the actual compilation commands.
- `getExportSteps()`: Returns steps to organize output files and generate metadata (e.g., C headers).

#### Platform Strategy
Defines how to integrate with CI/CD providers.
- `onInit()`: Handles platform-specific project initialization.
- `migrate()`: Translates the Refinery manifest into platform-native configuration files (e.g., GitHub Actions YAML).

### Target Registry
A centralized database mapping operating systems, architectures, and ABIs to specific compilation parameters. This includes:
- Target triples.
- Specific linkers and environment variables (e.g., `CARGO_TARGET_..._LINKER`).
- Required system packages (e.g., `musl-tools`).

## Error Handling
Refinery utilizes the `ripthrow` library for functional error handling. Operations return `Result` or `AsyncResult` types, ensuring that all failure paths are explicitly handled or documented.

## Built-in Actions
The orchestrator includes built-in actions for common tasks:
- `checkout`: Repository cloning.
- `setup_toolchain`: Compiler installation and target addition.
- `setup_linker`: Linker configuration and system dependency installation.
- `package`: Artifact compression and package generation.
- `upload_artifact` / `download_artifact`: Transferring files between CI jobs.
- `github_release`: Automating GitHub releases.
