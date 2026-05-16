// biome-ignore-all lint/suspicious/noExplicitAny: Bun Shell template tags require specific internal types for values
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
    const result = await $.nothrow()(strings, ...(values as any));

    return {
      stdout: result.stdout.toString().trim(),
      stderr: result.stderr.toString().trim(),
      exitCode: result.exitCode,
    };
  })();

  return safeAsync(execution);
}

/**
 * Executes a shell command with custom environment variables.
 */
export function shWithEnv(
  env: Record<string, string>,
): (strings: TemplateStringsArray, ...values: unknown[]) => AsyncResult<ShellOutput, Error> {
  return (strings: TemplateStringsArray, ...values: unknown[]) => {
    const execution = (async (): Promise<ShellOutput> => {
      const result = await $.env(env).nothrow()(strings, ...(values as any));

      return {
        stdout: result.stdout.toString().trim(),
        stderr: result.stderr.toString().trim(),
        exitCode: result.exitCode,
      };
    })();

    return safeAsync(execution);
  };
}
