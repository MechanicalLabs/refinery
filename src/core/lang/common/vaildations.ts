/** @swt-disable max-repetition */
import type { z } from "zod";
import { Abi } from "../../types/abi";
import { Os } from "../../types/os";
import { Package } from "../../types/packages";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: High complexity is inherent to the strict target platform validation rules.
export function validateBinaryTarget(
  data: {
    os: (typeof Os)[keyof typeof Os];
    abi?: (typeof Abi)[keyof typeof Abi] | undefined;
    packages?: (typeof Package)[keyof typeof Package][] | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  if (data.os === Os.macos && data.abi) {
    ctx.addIssue({
      code: "custom",
      message: "MacOS does not support ABIs",
      path: ["abi"],
    });
  }

  if (data.os === Os.linux && data.abi) {
    const allowed: (typeof Abi)[keyof typeof Abi][] = [Abi.gnu, Abi.musl];
    if (!allowed.includes(data.abi)) {
      ctx.addIssue({
        code: "custom",
        message: "Linux only supports 'gnu' or 'musl'",
        path: ["abi"],
      });
    }
  }

  if (data.os === Os.windows && data.abi) {
    const allowed: (typeof Abi)[keyof typeof Abi][] = [Abi.gnu, Abi.msvc];
    if (!allowed.includes(data.abi)) {
      ctx.addIssue({
        code: "custom",
        message: "Windows only supports 'msvc' or 'gnu'",
        path: ["abi"],
      });
    }
  }

  if (data.packages) {
    if (
      data.os !== Os.linux &&
      (data.packages.includes(Package.deb) || data.packages.includes(Package.rpm))
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Linux-specific packages (deb/rpm) are not allowed for other OS",
        path: ["packages"],
      });
    }

    if (data.os !== Os.windows && data.packages.includes(Package.msi)) {
      ctx.addIssue({
        code: "custom",
        message: "MSI packages are only allowed for Windows",
        path: ["packages"],
      });
    }
  }
}
