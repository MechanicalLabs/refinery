import pc from "picocolors";
import type { ZodError } from "zod";

export function formatZodError(err: ZodError): string {
  return err.issues
    .map((issue) => {
      // biome-ignore lint/nursery/noTernary: this is more readable in this case
      const path = issue.path.length > 0 ? ` at ${issue.path.join(".")}` : "";
      return `${pc.red(issue.message)}${path}`;
    })
    .join("\n");
}
