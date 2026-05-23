# Refinery

[![CI](https://github.com/MechanicalLabs/refinery/actions/workflows/ci.yml/badge.svg)](https://github.com/MechanicalLabs/refinery/actions/workflows/ci.yml)
[![Update Constants](https://github.com/MechanicalLabs/refinery/actions/workflows/update-constants.yml/badge.svg)](https://github.com/MechanicalLabs/refinery/actions/workflows/update-constants.yml)
[![Version](https://img.shields.io/github/v/release/MechanicalLabs/refinery?include_prereleases&style=flat-square)](https://github.com/MechanicalLabs/refinery/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Refinery is a configuration-driven CI/CD orchestrator designed to abstract cross-compilation and artifact packaging. It provides a unified interface to build, package, and release software across multiple operating systems and architectures.

## Concepts

### Artifacts
Artifacts are the primary outputs of a project. Refinery supports binaries and libraries. Each artifact can define a specific output name pattern and toggle features like C header generation for libraries.

### Targets
Targets define the execution environments for artifacts. A target consists of an operating system, one or more architectures, an optional ABI, and a set of desired package formats.

### Strategies
Refinery uses a strategy-based architecture to remain language and platform agnostic.
- **Language Strategies**: Handle toolchain validation, build command execution, and artifact location (e.g., Rust/Cargo).
- **Platform Strategies**: Handle CI configuration generation and execution (e.g., GitHub Actions).

## Configuration Reference

The `refinery.toml` file is the source of truth for the project.

### Configuration Example

```toml
version = 1
platform = "github"
lang = "rust"

# Release profile optimizations (Optional)
[release]
strip = true              # Strip symbols from binary
lto = true                # Enable Link Time Optimization
codegenUnits = 1          # Set codegen units (1 for maximum optimization)
panic = "abort"           # Panic strategy: "abort" or "unwind"

# Define what to build
[[artifacts]]
name = "refinery-cli"
type = "bin"              # "bin" or "lib"
outputName = "{name}-{os}-{arch}-{abi}" # Name template

[[artifacts]]
name = "refinery-core"
type = "lib"
headers = true            # Generate C headers using cbindgen (for lib only)

# Define where to build and package
[[targets]]
id = "linux-x64-gnu"
for = "refinery-cli"      # Links to artifact name
os = "linux"
arch = ["x86_64"]
abi = "gnu"               # Optional: "gnu", "musl", "msvc"
packages = ["tar.gz", "deb"] # Package formats
includeInPackage = ["LICENSE", "README.md"] # Extra files to include in .tar.gz

# Lifecycle Hooks: pre_build, post_build, publish
# Each step can be "builtin" or "composite"

[[pre_build]]
type = "builtin"
name = "Checkout code"
builtin = "checkout"
targets = "once"          # "once" (global), "all", or ["target-id"]

[[pre_build]]
type = "composite"
name = "Custom Setup"
action = "setup-environment" # Points to .github/actions/setup-environment
with = { node_version = "25" }
targets = ["linux-x64-gnu"]

[[post_build]]
type = "builtin"
name = "Create Packages"
builtin = "package"
targets = "all"

[[publish]]
type = "builtin"
name = "GitHub Release"
builtin = "github_release"
with = { generate_release_notes = true }
targets = "once"
```

### Schema Details

#### Step Properties (`pre_build`, `post_build`, `publish`)
- `type`: Must be `"builtin"` or `"composite"`.
- `name`: Optional display name for the step.
- `targets`: Controls execution scope:
    - `"once"`: Executes once per build session (global).
    - `"all"`: Executes for every target in the matrix.
    - `["id1", "id2"]`: Executes only for specific target IDs.
- `enabled`: Optional boolean to toggle the step.
- `with`: Key-value pairs for step parameters.
- `secrets`: (Composite only) Array of secret names to inject as environment variables.
- `permissions`: (Composite only) Map of GitHub Actions permissions required.

#### Available Builtin Actions
- **`pre_build`**: `checkout`, `setup_toolchain`, `setup_linker`.
- **`post_build`**: `package`, `upload_artifact`.
- **`publish`**: `download_artifact`, `github_release`.

### Supported Matrix

| Category | Supported Values |
| :--- | :--- |
| **OS** | `windows`, `linux`, `macos` |
| **Architectures** | `x86_64`, `x86`, `arm64`, `armv7`, `wasm32` |
| **ABIs** | `gnu`, `musl`, `msvc` |
| **Packagers** | `bin`, `zip`, `tar.gz`, `deb`, `rpm`, `msi` |

### Target Mapping Details

| OS | Arch | ABI | Rust Triple |
| :--- | :--- | :--- | :--- |
| Linux | x86_64 | gnu | `x86_64-unknown-linux-gnu` |
| Linux | x86_64 | musl | `x86_64-unknown-linux-musl` |
| Linux | arm64 | gnu | `aarch64-unknown-linux-gnu` |
| Linux | arm64 | musl | `aarch64-unknown-linux-musl` |
| Linux | x86 | gnu | `i686-unknown-linux-gnu` |
| Linux | x86 | musl | `i686-unknown-linux-musl` |
| Linux | armv7 | gnueabihf | `armv7-unknown-linux-gnueabihf` |
| Linux | wasm32 | - | `wasm32-unknown-unknown` |
| Windows | x86_64 | msvc | `x86_64-pc-windows-msvc` |
| Windows | x86_64 | gnu | `x86_64-pc-windows-gnu` |
| Windows | arm64 | msvc | `aarch64-pc-windows-msvc` |
| Windows | x86 | msvc | `i686-pc-windows-msvc` |
| Windows | x86 | gnu | `i686-pc-windows-gnu` |
| macOS | x86_64 | - | `x86_64-apple-darwin` |
| macOS | arm64 | - | `aarch64-apple-darwin` |

## CLI Commands

### `refinery init`
Initializes a new project by generating a `refinery.toml` manifest. It detects local artifacts (e.g., from `Cargo.toml`) and prompts for CI platform selection.
- `--force, -f`: Overwrites existing `refinery.toml`.

### `refinery check`
Validates the `refinery.toml` schema and checks the local environment for required toolchains and dependencies.
- `--manifest-only`: Skips environment toolchain checks.

### `refinery setup`
Installs required language toolchains (e.g., `rustup` targets) and system-level dependencies (e.g., linkers via `apt-get` on Linux).
- `--dry-run`: Displays commands without execution.

### `refinery build`
Executes the build pipeline for defined targets.
- `--target, -t <id>`: Limits the build to a specific target ID.
- `--setup`: Automatically runs environment setup before building.
- `--dry-run`: Previews the execution plan.

### `refinery migrate`
Synchronizes the `refinery.toml` configuration with the target CI platform (e.g., generates `.github/workflows/refinery-build.yml`).

## Build Pipeline Lifecycle

1. **Pre-build Global**: Execution of steps marked with `targets = "once"`.
2. **Target Setup**: Installation of target-specific toolchains and linkers.
3. **Pre-build Target**: Execution of target-specific pre-build hooks.
4. **Compilation**: Execution of the language-specific build command (e.g., `cargo build --release`).
5. **Export**: Staging of binaries, libraries, and generated headers.
6. **Packaging**: Creation of archives (`.zip`, `.tar.gz`) or native packages (`.deb`, `.rpm`, `.msi`).
7. **Post-build Target**: Execution of target-specific post-build hooks.
8. **Post-build Global**: Execution of steps marked with `targets = "once"`.
9. **Publish**: Final artifact distribution steps.
