import { cancel, confirm, group, intro, outro, select, spinner, text } from "@clack/prompts";
import pc from "picocolors";
import type { Result } from "ripthrow";

type StepResult<T> = T | symbol;

type PromptValidator = (value: string | undefined) => string | undefined;

const SIGINT_EXIT_CODE = 130;

export class PromptGroup {
  private readonly introText: string;

  constructor(title: string, subtitle?: string) {
    let header = pc.bgRed(pc.black(` ${title.toUpperCase()} `));
    if (subtitle) {
      header = `${header} ${pc.dim(subtitle)}`;
    }
    this.introText = header;
  }

  async run<T>(steps: { [K in keyof T]: () => Promise<StepResult<T[K]>> }): Promise<T> {
    intro(this.introText);

    const result = await group(steps as unknown as Parameters<typeof group>[0], {
      onCancel: () => {
        cancel("Operation cancelled.");
        process.exit(SIGINT_EXIT_CODE);
      },
    });

    return result as T;
  }

  static spinner(): { task: <T>(message: string, callback: () => Promise<T>) => Promise<T> } {
    const s = spinner();
    return {
      async task<T>(message: string, callback: () => Promise<T>): Promise<T> {
        s.start(message);
        const result = await callback();
        s.stop(`${message} ${pc.green("done")}`);
        return result;
      },
    };
  }

  static outro(message: string): void {
    outro(pc.dim(message));
  }
}

export const step = {
  text: (
    message: string,
    initialValue = "",
    validate?: (v: string) => string | undefined,
    placeholder = "",
  ): (() => Promise<StepResult<string>>) => {
    // @ts-expect-error: Not all code paths return a value
    // This is intentional to allow for validation errors to be returned
    const validator: PromptValidator = (value: string | undefined): string | undefined => {
      if (validate) {
        return validate(value ?? "");
      }
    };

    return (): Promise<StepResult<string>> =>
      text({
        message,
        placeholder,
        initialValue,
        validate: validator,
      }) as Promise<StepResult<string>>;
  },

  select:
    <T>(
      message: string,
      options: { value: T; label: string; hint?: string }[],
    ): (() => Promise<StepResult<T>>) =>
    (): Promise<StepResult<T>> =>
      select({
        message,
        options: options.map((opt) => {
          const option = {
            value: opt.value,
            label: opt.label,
            // biome-ignore lint/nursery/noTernary: This is more concise and readable for optional hints
            ...(opt.hint ? { hint: opt.hint } : {}),
          };
          return option as { value: T; label: string; hint?: string };
        }) as Parameters<typeof select>[0]["options"],
      }) as Promise<StepResult<T>>,

  confirm:
    (message: string, initialValue = true): (() => Promise<StepResult<boolean>>) =>
    (): Promise<StepResult<boolean>> =>
      confirm({ message, initialValue }) as Promise<StepResult<boolean>>,

  multiSelect:
    <T>(
      message: string,
      options: { value: T; label: string; hint?: string }[],
      required = true,
    ): (() => Promise<StepResult<T[]>>) =>
    (): Promise<StepResult<T[]>> =>
      import("@clack/prompts").then((clack) =>
        clack.multiselect({
          message,
          options: options.map((opt) => ({
            ...opt,
            hint: opt.hint ?? undefined,
            // biome-ignore lint/suspicious/noExplicitAny: Clack types are difficult to map with generic T
          })) as any,
          required,
        }),
      ) as Promise<StepResult<T[]>>,
};

/**
 * Bridges ripthrow Results with Clack's string | undefined requirement.
 *
 * Clack requires an explicit 'undefined' for success, but Biome's auto-formatting
 * often strips 'return undefined', leading to TypeScript errors under
 * 'noImplicitReturns'. We encapsulate the @ts-expect-error here to keep
 * UI implementations clean and type-safe.
 */
export function toUiValidator(
  validate: (v: string) => Result<void, string>,
): (v: string) => string | undefined {
  // @ts-expect-error: undefined return required by Clack UI contract
  return (v: string): string | undefined => {
    const res = validate(v);
    if (!res.ok) {
      return res.error;
    }
  };
}
