import { type AsyncResult, Ok } from "ripthrow";
import type {
  AbstractStep,
  LanguageStrategy,
  StrategyContext,
  TargetMetadata,
} from "../../strategy/types";

export const rustStrategy: LanguageStrategy = {
  id: "rust",
  name: "Rust",
  getInitialConfig: (projectName: string) => ({
    lang: "rust",
    artifacts: [{ type: "bin", name: projectName }],
    targets: [],
  }),
  onInit: (_ctx: StrategyContext): AsyncResult<void, Error> => {
    // Rust-specific initialization logic
    return Promise.resolve(Ok());
  },
  getSetupSteps: (ctx: StrategyContext, target: TargetMetadata): AbstractStep[] => {
    const steps: AbstractStep[] = [];
    const toolchain =
      ctx.config.lang === "rust" ? (ctx.config.toolchain as string) || "stable" : "stable";

    steps.push({
      type: "builtin",
      builtin: "setup_toolchain",
      name: "Setup Rust",
      with: {
        toolchain,
        target: target.triple,
        cache: true,
      },
    });

    if (target.headers) {
      steps.push({
        type: "builtin",
        builtin: "install_tool",
        name: "Install cbindgen",
        if: "matrix.headers == true",
        with: { tool: "cbindgen" },
      });
    }

    steps.push({
      type: "builtin",
      builtin: "setup_linker",
    });

    return steps;
  },
  getBuildSteps: (_ctx: StrategyContext, target: TargetMetadata): AbstractStep[] => {
    const steps: AbstractStep[] = [];

    steps.push({
      type: "shell",
      name: "Build",
      run: `cargo build --release --target ${target.triple}`,
      shell: "bash",
    });

    return steps;
  },
  getExportSteps: (_ctx: StrategyContext, target: TargetMetadata): AbstractStep[] => {
    const steps: AbstractStep[] = [];

    // Preparation
    if (target.artifactType === "bin") {
      steps.push({
        type: "shell",
        name: "Prepare Binary",
        run: [
          `SRC="target/${target.triple}/release/${target.artifactBin}${target.binExt}"`,
          `DST_ORIG="target/release/${target.artifactBin}${target.binExt}"`,
          `DST_RENAMED="target/release/${target.outputName}${target.binExt}"`,
          "",
          "mkdir -p target/release",
          'cp "$SRC" "$DST_ORIG"',
          'cp "$SRC" "$DST_RENAMED"',
        ].join("\n"),
        shell: "bash",
      });
    } else {
      steps.push({
        type: "shell",
        name: "Prepare Library",
        run: [
          `SRCDIR="target/${target.triple}/release"`,
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
          `NAME="${target.artifactBin}"`,
          `OUT="${target.outputName}"`,
          "",
          'copy_lib "$SRCDIR/lib${NAME}.so" "lib${NAME}.so" "lib${OUT}.so"',
          'copy_lib "$SRCDIR/lib${NAME}.dylib" "lib${NAME}.dylib" "lib${OUT}.dylib"',
          'copy_lib "$SRCDIR/lib${NAME}.a" "lib${NAME}.a" "lib${OUT}.a"',
          'copy_lib "$SRCDIR/${NAME}.dll" "${NAME}.dll" "${OUT}.dll"',
          'copy_lib "$SRCDIR/${NAME}.lib" "${NAME}.lib" "${OUT}.lib"',
          'copy_lib "$SRCDIR/lib${NAME}.dll.a" "lib${NAME}.dll.a" "lib${OUT}.dll.a"',
          'copy_lib "$SRCDIR/${NAME}.wasm" "${NAME}.wasm" "${OUT}.wasm"',
          "",
          `if [ "${target.headers}" = "true" ]; then`,
          '  if [ -f "cbindgen.toml" ]; then',
          '    cbindgen --config cbindgen.toml --crate "${NAME}" --output "$DSTDIR/${OUT}.h"',
          "  else",
          '    cbindgen --crate "${NAME}" --output "$DSTDIR/${OUT}.h"',
          "  fi",
          '  cp "$DSTDIR/${OUT}.h" "$DSTDIR/${NAME}.h"',
          "fi",
        ].join("\n"),
        shell: "bash",
      });
    }

    if (target.includeFiles.length > 0) {
      steps.push({
        type: "shell",
        name: "Copy Extra Files",
        run: `for f in ${target.includeFiles.join(" ")}; do\n  if [ -f "$f" ]; then\n    cp "$f" "target/release/"\n  fi\ndone`,
        shell: "bash",
      });
    }

    // Export Binary/Library to _packages
    steps.push({
      type: "shell",
      name: "Export Binary",
      if: "matrix.artifact_type == 'bin'",
      run: `mkdir -p _packages\ncp "target/release/${target.outputName}${target.binExt}" "_packages/"`,
      shell: "bash",
    });

    steps.push({
      type: "shell",
      name: "Export Library",
      if: "matrix.artifact_type == 'lib'",
      run: `mkdir -p _packages\ncp target/release/lib${target.outputName}.* _packages/ 2>/dev/null || true\ncp target/release/${target.outputName}.* _packages/ 2>/dev/null || true`,
      shell: "bash",
    });

    // Package Binary
    steps.push({
      type: "shell",
      name: "Package Binary",
      if: "matrix.artifact_type == 'bin'",
      run: [
        'ARCHIVE_DIR="${PWD}/_packages"',
        'mkdir -p "$ARCHIVE_DIR"',
        `STAGING_DIR="target/archive_staging/${target.outputName}"`,
        'mkdir -p "$STAGING_DIR"',
        `cp "target/release/${target.outputName}${target.binExt}" "$STAGING_DIR/"`,
        `for f in ${target.includeFiles.join(" ")}; do`,
        '  if [ -f "$f" ]; then',
        '    cp "$f" "$STAGING_DIR/"',
        "  fi",
        "done",
        'if [ "${{ matrix.package_type }}" = "zip" ] || [ "${{ matrix.os }}" = "windows" ]; then',
        `  (cd "$STAGING_DIR" && 7z a -tzip "$ARCHIVE_DIR/${target.outputName}.zip" .) > /dev/null`,
        "else",
        `  tar -czf "$ARCHIVE_DIR/${target.outputName}.tar.gz" -C "$STAGING_DIR" .`,
        "fi",
      ].join("\n"),
      shell: "bash",
    });

    // Package Library
    steps.push({
      type: "shell",
      name: "Package Library",
      if: "matrix.artifact_type == 'lib'",
      run: [
        'ARCHIVE_DIR="${PWD}/_packages"',
        'mkdir -p "$ARCHIVE_DIR"',
        `STAGING_DIR="target/archive_staging/${target.outputName}"`,
        'mkdir -p "$STAGING_DIR"',
        `cp target/release/lib${target.artifactBin}.* "$STAGING_DIR/" 2>/dev/null || true`,
        `cp target/release/${target.artifactBin}.* "$STAGING_DIR/" 2>/dev/null || true`,
        `for f in ${target.includeFiles.join(" ")}; do`,
        '  if [ -f "$f" ]; then',
        '    cp "$f" "$STAGING_DIR/"',
        "  fi",
        "done",
        'if [ "${{ matrix.package_type }}" = "zip" ] || [ "${{ matrix.os }}" = "windows" ]; then',
        `  (cd "$STAGING_DIR" && 7z a -tzip "$ARCHIVE_DIR/${target.outputName}.zip" .) > /dev/null`,
        "else",
        `  tar -czf "$ARCHIVE_DIR/${target.outputName}.tar.gz" -C "$STAGING_DIR" .`,
        "fi",
      ].join("\n"),
      shell: "bash",
    });

    // Platform-specific packagers (install via generic builtin, build via shell)

    // .deb
    steps.push({
      type: "builtin",
      builtin: "install_tool",
      name: "Install cargo-deb",
      with: { tool: "cargo-deb" },
      if: "${{ matrix.has_deb }}",
    });
    steps.push({
      type: "shell",
      name: "Build .deb package",
      if: "${{ matrix.has_deb }}",
      run: [
        "mkdir -p _packages",
        `cargo deb --target ${target.triple} --no-build -o _packages/`,
        "for f in _packages/*.deb; do",
        `  [ -f "$f" ] && mv "$f" "_packages/${target.outputName}.deb"`,
        "done",
      ].join("\n"),
      shell: "bash",
    });

    // .rpm
    steps.push({
      type: "builtin",
      builtin: "install_tool",
      name: "Install cargo-generate-rpm",
      with: { tool: "cargo-generate-rpm" },
      if: "${{ matrix.has_rpm }}",
    });
    steps.push({
      type: "shell",
      name: "Build .rpm package",
      if: "${{ matrix.has_rpm }}",
      run: [
        "mkdir -p _packages",
        "cargo generate-rpm -o _packages/",
        "for f in _packages/*.rpm; do",
        `  [ -f "$f" ] && mv "$f" "_packages/${target.outputName}.rpm"`,
        "done",
      ].join("\n"),
      shell: "bash",
    });

    // .msi
    steps.push({
      type: "builtin",
      builtin: "install_tool",
      name: "Install cargo-wix",
      with: { tool: "cargo-wix" },
      if: "${{ matrix.has_msi }}",
    });
    steps.push({
      type: "shell",
      name: "Build .msi package",
      if: "${{ matrix.has_msi }}",
      run: [
        "mkdir -p _packages",
        `cargo wix --target ${target.triple} -o _packages/`,
        `$msi = Get-ChildItem "_packages\\*.msi" | Select-Object -First 1`,
        `if ($msi) { Rename-Item -Path $msi.FullName -NewName "${target.outputName}.msi" }`,
      ].join("\n"),
      shell: "pwsh",
    });

    return steps;
  },
};
