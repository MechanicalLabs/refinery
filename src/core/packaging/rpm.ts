// biome-ignore-all lint/suspicious/noTemplateCurlyInString: GHA expressions

import { Actions } from "../platforms/github/constants";
import type { Packager } from "./types";

const C = "${{ matrix.has_rpm }}";

export const rpmPackager: Packager = {
  id: "rpm",
  condition: C,
  setupSteps: [
    {
      name: "Install cargo-rpm",
      ifCondition: C,
      uses: Actions.installPackager,
      with: { tool: "cargo-rpm" },
    },
  ],
  buildSteps: [
    {
      name: "Build .rpm package",
      ifCondition: C,
      run: [
        "mkdir -p _packages",
        "cargo rpm build --target ${{ matrix.target_triple }} -o _packages/",
        "for f in _packages/*.rpm; do",
        '  [ -f "$f" ] && mv "$f" "_packages/${{ matrix.output_name }}.rpm"',
        "done",
      ].join("\n"),
      shell: "bash",
      linker: "${{ matrix.linker }}",
    },
  ],
};
