// biome-ignore-all lint/suspicious/noTemplateCurlyInString: GHA expressions

import { Actions } from "../platforms/github/constants";
import type { Packager } from "./types";

const C = "${{ matrix.has_msi }}";

export const msiPackager: Packager = {
  id: "msi",
  condition: C,
  setupSteps: [
    {
      name: "Install cargo-wix",
      ifCondition: C,
      uses: Actions.installPackager,
      with: { tool: "cargo-wix" },
    },
  ],
  buildSteps: [
    {
      name: "Build .msi package",
      ifCondition: C,
      run: [
        "mkdir -p _packages",
        "cargo wix --target ${{ matrix.target_triple }} -o _packages/",
        '$msi = Get-ChildItem "_packages\\*.msi" | Select-Object -First 1',
        'if ($msi) { Rename-Item -Path $msi.FullName -NewName "${{ matrix.output_name }}.msi" }',
      ].join("\n"),
      shell: "pwsh",
    },
  ],
};
