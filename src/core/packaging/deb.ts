// biome-ignore-all lint/suspicious/noTemplateCurlyInString: GHA expressions

import { Actions } from "../platforms/github/constants";
import type { Packager } from "./types";

const C = "${{ matrix.has_deb }}";

export const debPackager: Packager = {
  id: "deb",
  condition: C,
  setupSteps: [
    {
      name: "Install cargo-deb",
      ifCondition: C,
      uses: Actions.installPackager,
      with: { tool: "cargo-deb" },
    },
  ],
  buildSteps: [
    {
      name: "Build .deb package",
      ifCondition: C,
      run: [
        "mkdir -p _packages",
        "cargo deb --target ${{ matrix.target_triple }} --no-build -o _packages/",
        "for f in _packages/*.deb; do",
        '  [ -f "$f" ] && mv "$f" "_packages/${{ matrix.output_name }}.deb"',
        "done",
      ].join("\n"),
      shell: "bash",
    },
  ],
};
