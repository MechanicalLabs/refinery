import { cancel, confirm, group, intro, outro, select, spinner, text } from "@clack/prompts";
import pc from "picocolors";

type StepResult<T> = T | symbol;

type PromptValidator = (value: string | undefined) => string | undefined;

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
        process.exit(0);
      },
    });

    return result as T;
  }

  static spinner(): { task: (message: string, callback: () => Promise<void>) => Promise<void> } {
    const s = spinner();
    return {
      async task(message: string, callback: () => Promise<void>): Promise<void> {
        s.start(message);
        await callback();
        s.stop(`${message} ${pc.green("done")}`);
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
    placeholder = "",
    validate?: (v: string) => string | undefined,
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
};
