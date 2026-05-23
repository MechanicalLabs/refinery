# Contributing to Refinery

Refinery is a TypeScript project running on the Bun runtime.

## Development Environment

### Prerequisites
- [Bun](https://bun.sh)
- [Rust](https://rustup.rs) (for testing Rust strategy)

### Setup
1. Clone the repository.
2. Install dependencies:
   ```bash
   bun install
   ```
3. Install git hooks:
   ```bash
   bun run prepare
   ```

## Workflow

### Code Standards
The project uses Biome for linting and formatting.
- Format code: `bun run format`
- Check linting: `bun run lint`

### Type Checking
Run the TypeScript compiler to verify types:
```bash
bun run check:types
```

### Testing
Refinery uses the Bun test runner.
- Run all tests: `bun test`
- Run tests with coverage: `bun test:coverage`
- Run E2E tests: `bun test tests/e2e/lifecycle.test.ts` (Requires Docker for some environments).

### Binary Compilation
To test the compiled binary:
```bash
bun run build:binary
./dist/refinery --help
```

## Architecture for Contributors

### Adding a Language Strategy
1. Create a new directory in `src/core/lang/`.
2. Implement the `LanguageStrategy` interface.
3. Register the strategy in `src/core/strategy/registry.ts`.
4. Define the configuration schema using Zod.

### Adding a Platform Strategy
1. Create a new directory in `src/core/platforms/`.
2. Implement the `PlatformStrategy` interface.
3. Register the strategy in `src/core/strategy/registry.ts`.

### Modifying the Target Matrix
The target database is located in `src/core/strategy/target-registry.ts`. When adding a target, ensure the triple and required system packages are accurate for both local and CI environments.
