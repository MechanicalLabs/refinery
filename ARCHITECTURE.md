# Refinery Architecture

Refinery is built with **TypeScript** on the **Bun** runtime. It prioritizes speed, type-safety, and a clean separation of concerns between orchestration logic and implementation details.

## Core Design Patterns

### 1. Strategy Pattern (The Engine)
Refinery doesn't hardcode logic for specific languages or CI platforms. Instead, it uses a **Strategy Pattern**.

*   **`LanguageStrategy`**: Handles toolchain detection, initialization, and build execution for specific languages (e.g., `RustStrategy`).
*   **`PlatformStrategy`**: Handles the generation of CI-specific configuration files (e.g., `GitHubActionsStrategy`).

These are registered in `src/core/strategy/registry.ts` and resolved at runtime based on the `refinery.toml`.

### 2. Command Pattern (The CLI)
CLI commands are encapsulated objects registered in a central `CommandRegistry`. This keeps the entry point (`src/index.ts`) clean and makes it trivial to add new commands like `migrate` or `discover`.

### 3. Functional Error Handling
We use [ripthrow](https://github.com/MechanicalLabs/ripthrow) to manage errors.
*   **No Exceptions:** We avoid `try/catch` for expected failures.
*   **Result Types:** Functions return `AsyncResult` or `Result` types.
*   **Explicit Mapping:** Errors are defined centrally in `src/errors.ts` and matched using `matchErr`.

---

## Directory Structure

```text
src/
├── cmd/                # CLI Command implementations
│   ├── init.ts         # The project initialization wizard
│   └── registry.ts     # Command discovery and registration
├── core/
│   ├── io/             # Filesystem and Manifest (TOML) operations
│   ├── lang/           # Language-specific strategies (Rust, etc.)
│   ├── platforms/      # CI-specific strategies (GitHub, etc.)
│   ├── strategy/       # Strategy interfaces and Registry logic
│   └── schema.ts       # Zod-backed refinery.toml definition
├── ui/                 # CLI presentation layer (logs, prompts)
├── utils/              # Shell execution and helpers
└── errors.ts           # Central error definitions
```

## Data Flow: `refinery init`

1.  **Discovery:** Refinery checks for existing manifests or language-specific files (like `Cargo.toml`).
2.  **Interactive Prompt:** The `PromptGroup` orchestrates a series of steps to gather project metadata.
3.  **Strategy Resolution:** Based on the user's choice, the `LanguageRegistry` and `PlatformRegistry` provide the necessary logic.
4.  **Manifest Creation:** A `refinery.toml` is generated and validated against the Zod schema.
5.  **Side Effects:** Strategies execute their `onInit` hooks (e.g., creating `.github/workflows/` or adding `.gitignore` entries).

---

## Technical Debt & Focus

*   **Current Focus:** Implementing the `migrate` command to generate real GitHub Action YAMLs.
*   **Constraint:** Native-first. Avoid introducing dependencies on Docker or complex cross-compilation wrappers unless the `LanguageStrategy` explicitly requires them.
