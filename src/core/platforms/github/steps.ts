// biome-ignore-all lint/suspicious/noTemplateCurlyInString: GHA
// biome-ignore-all lint/style/useNamingConvention: GHA env vars and config keys
// biome-ignore-all lint/nursery/noExcessiveLinesPerFile: GHA steps generator needs to contain all translation logic

import { PACKAGERS, type PackageStep } from "../../packaging";
import type { PostBuildStep, PreBuildStep, RefineryConfig } from "../../schema";
import { Actions } from "./constants";
import { buildMatrix } from "./matrix";

interface Step {
  name: string;
  uses?: string;
  run?: string;
  shell?: string;
  with?: Record<string, string | boolean>;
  env?: Record<string, string>;
  if?: string;
}

const defaultPreBuild: PreBuildStep[] = [
  { type: "builtin", builtin: "checkout", targets: "all" },
  { type: "builtin", builtin: "setup_toolchain", targets: "all" },
  { type: "builtin", builtin: "setup_linker", targets: "all" },
];

const defaultPostBuild: PostBuildStep[] = [
  { type: "builtin", builtin: "package", targets: "all" },
  { type: "builtin", builtin: "upload_artifact", targets: "all" },
];

function buildSystemDependenciesSteps(): Step[] {
  return [
    {
      name: "Setup Linker",
      uses: Actions.setupLinker,
      with: {
        "target-triple": "${{ matrix.target_triple }}",
        "extra-apt-packages": "${{ join(matrix.apt_packages, ' ') }}",
      },
    },
    {
      name: "Install System Dependencies (Windows) [WiX]",
      if: "runner.os == 'Windows' && matrix.has_msi",
      run: `choco install wixtoolset -y
$wixDir = Get-ChildItem "\${env:ProgramFiles}\\WiX*", "C:\\Program Files (x86)\\WiX*" -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
if ($wixDir -and (Test-Path "$($wixDir.FullName)\\bin\\candle.exe")) {
  Add-Content $env:GITHUB_PATH "$($wixDir.FullName)\\bin"
}`,
      shell: "powershell",
    },
    {
      name: "Set up MinGW (x86_64)",
      if: "runner.os == 'Windows' && matrix.abi == 'gnu' && matrix.arch == 'x86_64'",
      uses: Actions.setupMingw,
      with: {
        platform: "x64",
      },
    },
    {
      name: "Set up MinGW (i686)",
      if: "runner.os == 'Windows' && matrix.abi == 'gnu' && matrix.arch == 'x86'",
      uses: Actions.setupMingw,
      with: {
        platform: "x86",
      },
    },
  ];
}

function buildCompilationSteps(): Step[] {
  return [
    {
      name: "Build",
      run: "cargo build --release --target ${{ matrix.target_triple }}",
      shell: "bash",
    },
  ];
}

function buildPreparationSteps(): Step[] {
  return [
    {
      name: "Prepare Binary",
      if: "matrix.artifact_type == 'bin'",
      run: 'SRC="target/${{ matrix.target_triple }}/release/${{ matrix.artifact_bin }}${{ matrix.bin_ext }}"\nDST_ORIG="target/release/${{ matrix.artifact_bin }}${{ matrix.bin_ext }}"\nDST_RENAMED="target/release/${{ matrix.output_name }}${{ matrix.bin_ext }}"\n\nmkdir -p target/release\ncp "$SRC" "$DST_ORIG"\ncp "$SRC" "$DST_RENAMED"',
      shell: "bash",
    },
    {
      name: "Prepare Library",
      if: "matrix.artifact_type == 'lib'",
      run: [
        'SRCDIR="target/${{ matrix.target_triple }}/release"',
        'DSTDIR="target/release"',
        'mkdir -p "$DSTDIR"',
        "",
        "copy_lib() {",
        '  local src_file="$1"',
        '  local dst_orig_file="$2"',
        '  local dst_renamed_file="$3"',
        '  if [ -f "$src_file" ]; then',
        '    cp "$src_file" "$DSTDIR/$dst_orig_file"',
        '    cp "$src_file" "$DSTDIR/$dst_renamed_file"',
        "  fi",
        "}",
        "",
        'NAME="${{ matrix.artifact_bin }}"',
        'OUT="${{ matrix.output_name }}"',
        "",
        'copy_lib "$SRCDIR/lib${NAME}.so" "lib${NAME}.so" "lib${OUT}.so"',
        'copy_lib "$SRCDIR/lib${NAME}.dylib" "lib${NAME}.dylib" "lib${OUT}.dylib"',
        'copy_lib "$SRCDIR/lib${NAME}.a" "lib${NAME}.a" "lib${OUT}.a"',
        'copy_lib "$SRCDIR/${NAME}.dll" "${NAME}.dll" "${OUT}.dll"',
        'copy_lib "$SRCDIR/${NAME}.lib" "${NAME}.lib" "${OUT}.lib"',
        'copy_lib "$SRCDIR/lib${NAME}.dll.a" "lib${NAME}.dll.a" "lib${OUT}.dll.a"',
        'copy_lib "$SRCDIR/${NAME}.wasm" "${NAME}.wasm" "${OUT}.wasm"',
        "",
        'if [ "${{ matrix.headers }}" = "true" ]; then',
        '  if [ -f "cbindgen.toml" ]; then',
        '    cbindgen --config cbindgen.toml --crate "${NAME}" --output "$DSTDIR/${OUT}.h"',
        "  else",
        '    cbindgen --crate "${NAME}" --output "$DSTDIR/${OUT}.h"',
        "  fi",
        '  cp "$DSTDIR/${OUT}.h" "$DSTDIR/${NAME}.h"',
        "fi",
      ].join("\n"),
      shell: "bash",
    },
    {
      name: "Copy Extra Files",
      if: "${{ matrix.include_files[0] }}",
      run: 'for f in ${{ join(matrix.include_files, \' \') }}; do\n  if [ -f "$f" ]; then\n    cp "$f" "target/release/"\n  fi\ndone',
      shell: "bash",
    },
  ];
}

function toStep(ps: PackageStep): Step {
  const step: Step = { name: ps.name, if: ps.ifCondition };

  if (ps.run) {
    step.run = ps.run;
  }
  if (ps.uses) {
    step.uses = ps.uses;
  }
  if (ps.with) {
    step.with = ps.with;
  }
  if (ps.shell) {
    step.shell = ps.shell;
  }
  if (ps.linker && ps.linker.trim() !== "" && !ps.linker.includes("${{")) {
    step.env = {
      RUSTFLAGS: `-C linker=${ps.linker}`,
    };
  }

  return step;
}

function buildPackagingSteps(): Step[] {
  const steps: Step[] = [];

  for (const pkg of ["deb", "rpm", "msi"] as const) {
    const packager = PACKAGERS[pkg];
    if (packager) {
      steps.push(...packager.setupSteps.map(toStep));
      steps.push(...packager.buildSteps.map(toStep));
    }
  }

  return steps;
}

function buildBinarySteps(): Step[] {
  return [
    {
      name: "Export Binary",
      if: "(matrix.has_bin) && (matrix.artifact_type == 'bin')",
      run: 'mkdir -p _packages\ncp "target/release/${{ matrix.output_name }}${{ matrix.bin_ext }}" "_packages/"',
      shell: "bash",
    },
    {
      name: "Export Library",
      if: "(matrix.has_bin) && (matrix.artifact_type == 'lib')",
      run: "mkdir -p _packages\ncp target/release/lib${{ matrix.output_name }}.* _packages/ 2>/dev/null || true\ncp target/release/${{ matrix.output_name }}.* _packages/ 2>/dev/null || true",
      shell: "bash",
    },
  ];
}

function buildArchiveSteps(): Step[] {
  return [
    {
      name: "Package Binary",
      if: "(matrix.has_archive) && (matrix.artifact_type == 'bin')",
      run: 'ARCHIVE_DIR="${PWD}/_packages"\nmkdir -p "$ARCHIVE_DIR"\nSTAGING_DIR="target/archive_staging/${{ matrix.output_name }}"\nmkdir -p "$STAGING_DIR"\ncp "target/release/${{ matrix.output_name }}${{ matrix.bin_ext }}" "$STAGING_DIR/"\nfor f in ${{ join(matrix.include_files, \' \') }}; do\n  if [ -f "$f" ]; then\n    cp "$f" "$STAGING_DIR/"\n  fi\ndone\n\nif [ "${{ matrix.package_type }}" = "zip" ]; then\n  (cd "$STAGING_DIR" && 7z a -tzip "$ARCHIVE_DIR/${{ matrix.output_name }}.zip" .) > /dev/null\nelse\n  tar -czf "$ARCHIVE_DIR/${{ matrix.output_name }}.tar.gz" -C "$STAGING_DIR" .\nfi',
      shell: "bash",
    },
    {
      name: "Package Library",
      if: "(matrix.has_archive) && (matrix.artifact_type == 'lib')",
      run: [
        'ARCHIVE_DIR="${PWD}/_packages"',
        'mkdir -p "$ARCHIVE_DIR"',
        'STAGING_DIR="target/archive_staging/${{ matrix.output_name }}"',
        'mkdir -p "$STAGING_DIR"',
        'cp target/release/lib${{ matrix.artifact_bin }}.* "$STAGING_DIR/" 2>/dev/null || true',
        'cp target/release/${{ matrix.artifact_bin }}.* "$STAGING_DIR/" 2>/dev/null || true',
        "for f in ${{ join(matrix.include_files, ' ') }}; do",
        '  if [ -f "$f" ]; then',
        '    cp "$f" "$STAGING_DIR/"',
        "  fi",
        "done",
        'if [ "${{ matrix.package_type }}" = "zip" ]; then',
        '  (cd "$STAGING_DIR" && 7z a -tzip "$ARCHIVE_DIR/${{ matrix.output_name }}.zip" .) > /dev/null',
        "else",
        '  tar -czf "$ARCHIVE_DIR/${{ matrix.output_name }}.tar.gz" -C "$STAGING_DIR" .',
        "fi",
      ].join("\n"),
      shell: "bash",
    },
  ];
}

function getMatchingTriples(
  targetIds: string[],
  config: RefineryConfig,
  entries: ReturnType<typeof buildMatrix>,
): string[] {
  const matchingTriples: string[] = [];
  for (const targetId of targetIds) {
    const target = config.targets?.find((t) => t.id === targetId);
    if (target) {
      for (const arch of target.arch) {
        const entry = entries.find(
          (e) =>
            e.artifact === target.for &&
            e.os === target.os &&
            e.arch === arch &&
            e.abi === target.abi,
        );
        if (entry) {
          matchingTriples.push(entry.target_triple);
        }
      }
    }
  }
  return matchingTriples;
}

function getTargetsCondition(
  targets: "once" | "all" | string[],
  config: RefineryConfig,
  entries: ReturnType<typeof buildMatrix>,
): string | undefined {
  let result: string | undefined;
  if (targets === "once") {
    const firstTriple = entries[0]?.target_triple;
    if (firstTriple) {
      result = `matrix.target_triple == '${firstTriple}'`;
    }
  } else if (Array.isArray(targets)) {
    const triples = getMatchingTriples(targets, config, entries);
    if (triples.length > 0) {
      result = triples.map((t) => `matrix.target_triple == '${t}'`).join(" || ");
    }
  }
  return result;
}

function getStepIfCondition(
  step: PreBuildStep | PostBuildStep,
  config: RefineryConfig,
): string | undefined {
  const targets = step.targets ?? "once";
  if (targets === "all") {
    return;
  }

  const entries = buildMatrix(config);
  if (entries.length === 0) {
    return;
  }

  return getTargetsCondition(targets, config, entries);
}

function translateCheckout(baseIf?: string): Step {
  const step: Step = {
    name: "Checkout",
    uses: Actions.checkout,
  };
  if (baseIf) {
    step.if = baseIf;
  }
  return step;
}

function buildCbindgenInstallStep(config: RefineryConfig): Step | undefined {
  // Check if any target or artifact has headers enabled
  const hasHeaders =
    config.targets?.some((t) => t.type === "lib" && t.headers) ||
    config.artifacts?.some((a) => a.type === "lib" && a.headers);
  if (!hasHeaders) {
    return;
  }
  return {
    name: "Install cbindgen",
    if: "matrix.headers == true",
    uses: "taiki-e/install-action@v2",
    with: {
      tool: "cbindgen",
    },
  };
}

function translateSetupToolchain(step: PreBuildStep | PostBuildStep, baseIf?: string): Step {
  const s: Step = {
    name: "Setup Rust",
    uses: Actions.setupRust,
    with: {
      target: "${{ matrix.target_triple }}",
      cache: true,
      ...(step.with ?? {}),
    },
  };
  if (baseIf) {
    s.if = baseIf;
  }
  return s;
}

function translateSetupLinker(baseIf?: string): Step[] {
  const depSteps = buildSystemDependenciesSteps();
  for (const ds of depSteps) {
    if (baseIf) {
      if (ds.if) {
        ds.if = `(${ds.if}) && (${baseIf})`;
      } else {
        ds.if = baseIf;
      }
    }
  }
  return depSteps;
}

function translatePackage(baseIf?: string): Step[] {
  const packageSteps = [
    ...buildPreparationSteps(),
    ...buildPackagingSteps(),
    ...buildBinarySteps(),
    ...buildArchiveSteps(),
  ];
  for (const ps of packageSteps) {
    if (baseIf) {
      if (ps.if) {
        ps.if = `(${ps.if}) && (${baseIf})`;
      } else {
        ps.if = baseIf;
      }
    }
  }
  return packageSteps;
}

function translateUploadArtifact(step: PreBuildStep | PostBuildStep, baseIf?: string): Step {
  const s: Step = {
    name: "Upload Artifact",
    uses: Actions.uploadArtifact,
    with: {
      name: "${{ matrix.output_name }}",
      path: "_packages/",
      ...(step.with ?? {}),
    },
  };
  if (baseIf) {
    s.if = baseIf;
  }
  return s;
}

function translateBuiltinStep(
  step: PreBuildStep | PostBuildStep,
  config: RefineryConfig,
  baseIf?: string,
): Step[] {
  if (step.type !== "builtin") {
    return [];
  }
  if (step.builtin === "checkout") {
    return [translateCheckout(baseIf)];
  }
  if (step.builtin === "setup_toolchain") {
    const steps = [translateSetupToolchain(step, baseIf)];
    const installCbindgen = buildCbindgenInstallStep(config);
    if (installCbindgen) {
      if (baseIf) {
        installCbindgen.if = `(${installCbindgen.if}) && (${baseIf})`;
      }
      steps.push(installCbindgen);
    }
    return steps;
  }
  if (step.builtin === "setup_linker") {
    return translateSetupLinker(baseIf);
  }
  if (step.builtin === "package") {
    return translatePackage(baseIf);
  }
  if (step.builtin === "upload_artifact") {
    return [translateUploadArtifact(step, baseIf)];
  }
  return [];
}

function translateCompositeStep(step: PreBuildStep | PostBuildStep, baseIf?: string): Step[] {
  if (step.type !== "composite") {
    return [];
  }
  const s: Step = {
    name: step.name ?? `Execute ${step.action}`,
    uses: `./.github/actions/${step.action}`,
  };

  if (step.with) {
    s.with = step.with as Record<string, string | boolean>;
  }

  if (step.secrets && Array.isArray(step.secrets)) {
    s.env = {};
    for (const secret of step.secrets) {
      s.env[secret] = `\${{ secrets.${secret} }}`;
    }
  }

  if (baseIf) {
    s.if = baseIf;
  }

  return [s];
}

function translateStep(step: PreBuildStep | PostBuildStep, config: RefineryConfig): Step[] {
  const baseIf = getStepIfCondition(step, config);
  if (step.type === "builtin") {
    return translateBuiltinStep(step, config, baseIf);
  }
  if (step.type === "composite") {
    return translateCompositeStep(step, baseIf);
  }
  return [];
}

export function buildSteps(config: RefineryConfig): Step[] {
  const steps: Step[] = [];

  let preBuildSteps = defaultPreBuild;
  if (config.pre_build && config.pre_build.length > 0) {
    preBuildSteps = config.pre_build;
  }

  for (const step of preBuildSteps) {
    if (step.enabled !== false) {
      steps.push(...translateStep(step, config));
    }
  }

  steps.push(...buildCompilationSteps());

  let postBuildSteps = defaultPostBuild;
  if (config.post_build && config.post_build.length > 0) {
    postBuildSteps = config.post_build;
  }

  for (const step of postBuildSteps) {
    if (step.enabled !== false) {
      steps.push(...translateStep(step, config));
    }
  }

  return steps;
}
