import { $ } from "bun";
import { type AsyncResult, safeAsync } from "ripthrow";

export interface ShellOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Executes a shell command using Bun Shell and returns an AsyncResult.
 */
export function sh(
  strings: TemplateStringsArray,
  ...values: unknown[]
): AsyncResult<ShellOutput, Error> {
  const execution = (async (): Promise<ShellOutput> => {
    // Use .nothrow() because we want to handle the exit code ourselves
    // and convert it into a Result.
    // biome-ignore lint/suspicious/noExplicitAny: Bun Shell's template tags require specific internal types for values
    const result = await $.nothrow()(strings, ...(values as any));

    return {
      stdout: result.stdout.toString().trim(),
      stderr: result.stderr.toString().trim(),
      exitCode: result.exitCode,
    };
  })();

  return safeAsync(execution);
}
