# Agent Instructions

> Note: `CLAUDE.md` & `GEMINI.md` are a symlink to `AGENTS.md`. They are the same file.

## Architectural Mandates

-   **Error Handling**: Prohibited the use of `try/catch` for flow control. All expected failures must use the `ripthrow` library and return `Result` or `AsyncResult`. 
    - Use the centralized error factory in `src/errors.ts`. Register new domain errors here rather than using ad-hoc strings.
    - Wrap any third-party or potentially throwing operations in `safe()` or `safeAsync()` to convert them into Result/AsyncResult.
    -   **Ripthrow wiki**: You MUST investigate about `ripthrow`: `https://github.com/MechanicalLabs/ripthrow/wiki` and it's sections: `/Getting-Started`, `/Functional-Operators`, `/Error-Handling-Patterns`, `/API-Reference`
-   **Type Safety**: Strict typing is required. Avoid `any` at all costs. Use Zod schemas in `src/core/schema.ts` for configuration validation.
-   **Filesystem Operations**: Always implement fail-fast validation. Use `existsSync` or `exists` from `src/core/io/fs.ts` to verify file dependencies before executing logic that depends on them.
-   **Linting (Biome)**:
    -   All code must pass `bun run verify`.
    -   Biome automatically removes `return undefined` in arrow functions. When a function's return type is `string | undefined` and an implicit return is used, you MUST use `@ts-expect-error` to satisfy the TypeScript compiler's `noImplicitReturns` rule.
    -   Avoid `await` in loops; use `Promise.all` or appropriate `biome-ignore` comments if sequential execution is strictly required for UI/interactive flows.

## Architecture & Patterns

-   **Strategy Pattern**: When adding support for new languages or platforms, implement the corresponding Strategy interface in `src/core/lang/` or `src/core/platforms/` and register it in `src/core/strategy/registry.ts`.
-   **UI Layer**: Use the `step` utilities in `src/ui/prompt.ts` for all interactive CLI flows. Note that current prompt validators are synchronous.

## Rules for adding new code

- **Versions**: No hard-coded versions in `workflow.ts`; use `constants.ts` (auto-updated). You MUST only verify versions via `web_fetch` for dependencies you are adding or modifying; do not check or downgrade existing ones.
- **Prohibited Comments**:
  - **Redundant Syntax/Tutorials**: e.g., `const p = new Command(); // Init program`. Avoid "how-to" lists.
  - **Style**: No third-person ("we do X") or "thinking out loud" (speculation).
  - **Reliability & TODOs**: You are writing code that **MUST NOT FAIL**. If you must use a `// TODO: [Reason]` or introduce technical debt for speed, you MUST notify the user immediately.
- **Documentation**: Focus on **why** (rationale/intent) for complex or non-obvious logic.
  - **Bad**: `// I think we should check if file exists here...` (Thinking out loud).
  - **VERY BAD (List-style/Tutorial)**:
    ```typescript
    // 1. Instantiate this class
    const x = new Y();
    // 2. Update `z` content
    x.setZ("A"); // For now, we use `A`...
    ```
  - **Good**:
    ```typescript
    /**
     * Strategies are initialized before manifest parsing to ensure 
     * platform-specific Zod schema overrides are registered.
     */
    await StrategyRegistry.init(config);
    ```
- **Testing**: No feature or bugfix is complete without automated tests. Follow existing patterns in `*.test.ts` files.
- **Idiomatic Code**: Before implementing new logic, search the codebase for similar patterns to ensure consistency.
## Rules for AI-Assisted Agents

- **DO NOT COMMIT CODE WITHOUT USER'S CODE-REVIEW**: You MUST ask the user before commiting ANY FILE.
- **Surgical Updates**: When modifying files, prioritize small, incremental changes so the human reviewer can easily approve/deny them. Before each modification, provide a very concise "what and why" explanation to justify the change without wasting tokens.
- If the user explicitly ask you to commit, you must follow **Conventional Commits**.
- No fluff, no praise, no emojis (the only emojis allowed are ⚠️✅❌ and do not abuse of it's usage). Be concise and skip the pleasantries.
- **Language**: All code, documentation, and commit messages MUST be in English. However, you MUST communicate with the user in the language they are using (e.g., if the user speaks Spanish, reply in Spanish).
