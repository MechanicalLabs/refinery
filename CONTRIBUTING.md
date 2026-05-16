# Contributing to Refinery

Thank you for your interest in contributing! Refinery is built with a focus on high-performance, type-safety, and strict architectural patterns.

## Development Setup

1.  **Environment**: You need [Bun](https://bun.sh/) installed.
2.  **Install Dependencies**:
    ```bash
    bun install
    ```
3.  **Verify**: Ensure the project passes all checks before starting.
    ```bash
    bun run verify
    ```

## Engineering Standards

-   **Error Handling**: We use [ripthrow](https://github.com/MechanicalLabs/ripthrow). We avoid `try/catch` for expected errors; instead, we return `Result` or `AsyncResult` types.
-   **Linting & Formatting**: We use [Biome](https://biomejs.dev/). All code must pass `bun run lint`. Note that Biome may remove `return undefined` in some contexts; use `@ts-expect-error` to satisfy TypeScript if `noImplicitReturns` is triggered.
-   **Validation**: We prioritize fail-fast checks for all I/O operations to catch configuration errors early.

## AI-Assisted Contributions

We value the efficiency that AI tools can bring to development. To help maintain Refinery's reliability, we encourage the following practices when using AI assistance:

1.  **Consistency**: Please ensure that AI-suggested code is integrated to follow the project's established patterns and naming conventions.
2.  **Verification**: All contributions should pass the `bun run verify` suite to ensure they meet the project's quality standards for types and linting.
3.  **Collaborative Review**: If a significant portion of a Pull Request was written with the assistance of an AI, mentioning it in the description is helpful. This allows reviewers to provide more focused feedback on potential logical edge cases or patterns that may be unique to generated code.

## Submitting a Pull Request

1.  Create a feature branch.
2.  Ensure your changes are well-tested.
3.  Run `bun run verify` one last time.
4.  Submit your PR with a clear description of the changes.
