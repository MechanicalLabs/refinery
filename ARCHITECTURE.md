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
