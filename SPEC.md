# Refinery Specification

Refinery is a high-performance, native-first build orchestrator. It is designed to replace complex, hard-to-maintain CI/CD YAML configurations with a portable, type-safe blueprint.

## Core Philosophy

*   **Native-First:** We prioritize host-system toolchains over containers. No Docker or Zig/Cross overhead unless explicitly requested. If `rustup` is there, we use it.
*   **Zero-Fluff:** The orchestrator should be transparent. Its only job is to set up the environment and trigger the compiler as fast as possible.
*   **Portable Logic:** Build logic belongs in the repository, not the CI provider's database. `refinery.toml` is the source of truth.

---

## Configuration (`refinery.toml`)

The manifest uses TOML for human readability and strict Zod schemas for validation.

### Root Fields

| Field | Type | Description |
| :--- | :--- | :--- |
| `version` | `number` | Manifest schema version (currently `1`). |
| `name` | `string` | Project identifier. |
| `platform` | `enum` | Target CI platform (e.g., `github`). |
| `lang` | `enum` | Build engine (e.g., `rust`). |

### Artifact Definitions

Artifacts define *what* is being built.

```toml
[[artifact]]
name = "my-bin"
type = "bin" # or "lib"
output_name = "my-bin-{os}-{arch}"
```

### Build Matrix (Targets)

Targets define *where* and *how* artifacts are built.

```toml
[[target]]
id = "linux-stable"
for = "my-bin"
os = "linux"
archs = ["x86_64", "arm64"]
abi = "gnu"
packages = ["tar.gz", "deb"]
```

---

## CLI Interface

### `refinery init`
Interactive wizard to bootstrap a project. It detects local environments (like `Cargo.toml`) and generates a baseline `refinery.toml`.

### `refinery migrate`
Syncs the `refinery.toml` with the platform-specific configuration (e.g., `.github/workflows/refinery.yml`). This is a destructive operation that ensures the CI is always a reflection of the manifest.

### `refinery build <artifact> <target>`
The internal engine command. Usually executed by the CI runner.
1. Resolves the context (OS, Arch, ABI).
2. Maps standardized names to toolchain triples.
3. Executes pre-build hooks.
4. Triggers the language strategy.
5. Executes post-build hooks.

---

## Technical Mandates

1.  **Selective Installation:** Only install what is needed for the current job. Don't waste time installing `cargo-wix` on a Linux runner.
2.  **Unified Naming:** Users specify `arm64`. Refinery maps it to `aarch64-unknown-linux-gnu` or whatever the toolchain requires.
3.  **Error Handling:** Every failure must be explicit. We use `ripthrow` to treat errors as values. No unhandled exceptions.
4.  **Caching:** Mandatory use of CI-native caching. If the orchestrator doesn't support the platform's cache, it's a bug.
