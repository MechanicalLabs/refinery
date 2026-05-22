import type { Packager } from "./types";

const C = "${{ matrix.has_rpm }}";

export const rpmPackager: Packager = {
  id: "rpm",
  condition: C,
  setupSteps: [
    {
      name: "Install cargo-generate-rpm",
      ifCondition: C,
      run: "cargo install cargo-generate-rpm",
      shell: "bash",
    },
  ],
  buildSteps: [
    {
      name: "Build .rpm package",
      ifCondition: C,
      run: [
        "mkdir -p _packages",
        "cargo generate-rpm -o _packages/",
        "for f in _packages/*.rpm; do",
        '  [ -f "$f" ] && mv "$f" "_packages/${{ matrix.output_name }}.rpm"',
        "done",
      ].join("\n"),
      shell: "bash",
      linker: "${{ matrix.linker }}",
    },
  ],
};
