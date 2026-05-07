# Refinery Architecture

## File Structure

- `src/`
  - `index.ts`: entrypoint.
  - `cmd/`: commands.
    - `index.ts`: core file to register all the commands.
    - `init.ts`: command definition for project initialization.
  - `errors/`: all project error classes.
  - `ui/`: all CLI utilities.
    - `icons.ts`: project CLI icons (unicode).
    - `log.ts`: all log functions (info, warn, error...).
    - `prompt.ts`: inquire helper for interactive CLI.
  - `core/`: project internal files.
    - `schema.ts`: `refinery.toml` file definition.
    - `lang/<lang>/`: lang definitions.
      - `schema.ts`: per language schema definitions.
    - `workflow/`: workflow definitions.

## Adding a new language definition

1. Create a folder in `src/core/lang/<language_name>`

2. Create a `schema.ts`

    Example:

    ```typescript
    import { z } from "zod";

    /**
     * `refinery.toml` definition for Rust language.
    */ 
    export const RustConfigSchema = z
      .object({
        exampleProp: z.string(),
      })
      .strict();

    // Export `zod` types
    export type RustConfig = z.infer<typeof RustConfigSchema>;
    ```

3. Register the language in root `schema.ts` using the `registerLang` helper function.

    Example:

    ```typescript
    export const RefineryConfigSchema = z.discriminatedUnion("lang", [
      // ... (other language definitions) ...
      registerLang(RustConfigSchema, "rust"),
    ]);
    ```
