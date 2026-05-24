// biome-ignore-all lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
// biome-ignore-all lint/performance/noAwaitInLoops: sequential toolchain checks are intentional
import path from "node:path";
import { type AsyncResult, Err, Ok } from "ripthrow";
import { Errors } from "../../../errors";
import { exists, readFile } from "../../io/fs";
import { LocalEnv } from "../../strategy/local-env";
import type {
  AbstractStep,
  LanguageStrategy,
  StrategyContext,
  TargetMetadata,
} from "../../strategy/types";
import type { CommonBinaryArtifact, CommonLibraryArtifact } from "../common/schema/artifact";
import { RUST_CAPABILITIES } from "./capabilities";
import { parseCargoToml } from "./cargo";
import { RustConfigSchema } from "./schema";
import { RustTargets } from "./targets";

function detectRustArtifacts(content: string): (CommonBinaryArtifact | CommonLibraryArtifact)[] {
  const info = parseCargoToml(content);
  const artifacts: (CommonBinaryArtifact | CommonLibraryArtifact)[] = [];

  let bins: string[];
  if (info.binNames.length > 0) {
    bins = info.binNames;
  } else {
    bins = [info.packageName];
  }
  for (const name of bins) {
    artifacts.push({ type: "bin", name, outputName: "{name}-{os}-{arch}" });
  }

  for (const name of info.libNames) {
    artifacts.push({ type: "lib", name, headers: false });
  }

  return artifacts;
}

export const rustStrategy: LanguageStrategy = {
  id: "rust",
  name: "Rust",
  capabilities: RUST_CAPABILITIES,
  configSchema: RustConfigSchema,

  getInitialConfig: (projectName: string) => ({
    lang: "rust",
    artifacts: [{ type: "bin", name: projectName }],
    targets: [],
  }),

  onInit: (_ctx: StrategyContext): AsyncResult<void, Error> => Promise.resolve(Ok()),

  detectArtifacts: async (
    cwd: string,
  ): AsyncResult<(CommonBinaryArtifact | CommonLibraryArtifact)[], Error> => {
    const existsRes = await exists(path.join(cwd, "Cargo.toml"));
    if (!existsRes.ok) {
      return Ok([] as (CommonBinaryArtifact | CommonLibraryArtifact)[]);
    }
    const readRes = await readFile(path.join(cwd, "Cargo.toml"));
    if (!readRes.ok) {
      return readRes;
    }
    return Ok(detectRustArtifacts(readRes.value));
  },

  getToolchainVersion: (config) =>
    ((config as Record<string, unknown>)["toolchain"] as string) || "stable",

  getRequiredTools: (config) => {
    const tools = ["rustc", "cargo"];
    const hasHeaders = config.targets.some((t) => t.type === "lib" && t.headers);
    if (hasHeaders) {
      tools.push("cbindgen");
    }
    return tools;
  },

  validateToolchain: async (config): AsyncResult<void, Error> => {
    for (const tool of rustStrategy.getRequiredTools(config)) {
      const res = await LocalEnv.checkTool(tool, tool, true);
      if (!res.ok) {
        return res;
      }
    }
    return Ok();
  },

  validateArtifacts: async (config): AsyncResult<void, Error> => {
    const cfg = config as Record<string, unknown>;
    const artifacts = cfg["artifacts"] as { name: string; type: string }[] | undefined;
    if (!artifacts || artifacts.length === 0) {
      return Ok();
    }

    const hasCargo = await exists("Cargo.toml");
    if (!hasCargo.ok) {
      return Ok();
    }

    const cargoRes = await readFile("Cargo.toml");
    if (!cargoRes.ok) {
      return Ok();
    }

    const info = parseCargoToml(cargoRes.value);
    const cargoNames = new Set<string>();
    for (const name of info.binNames.length > 0 ? info.binNames : [info.packageName]) {
      cargoNames.add(name);
    }
    for (const name of info.libNames) {
      cargoNames.add(name);
    }

    for (const artifact of artifacts) {
      if (!cargoNames.has(artifact.name)) {
        const reason =
          `Artifact '${artifact.name}' not found in Cargo.toml. ` +
          `Expected one of: ${[...cargoNames].join(", ") || "(none)"}. ` +
          "Run `refinery init` to regenerate artifact definitions from Cargo.toml.";
        return Err(Errors.artifactValidationFailed({ reason }));
      }
    }
    return Ok();
  },

  getSetupSteps: (ctx: StrategyContext, target: TargetMetadata): AbstractStep[] => {
    const steps: AbstractStep[] = [];
    const toolchain = rustStrategy.getToolchainVersion(ctx.config);

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

  getBuildSteps: (_ctx: StrategyContext, target: TargetMetadata): AbstractStep[] => [
    {
      type: "shell",
      name: "Build",
      run: [
        'CMD="cargo build --release"',
        `CMD="$CMD --target ${target.triple}"`,
        `FEATURES="${target.features}"`,
        'if [ -n "$FEATURES" ]; then',
        '  CMD="$CMD --features \\"$FEATURES\\""',
        "fi",
        `NO_DEFAULT="${String(target.defaultFeatures)}"`,
        'if [ "$NO_DEFAULT" = "false" ]; then',
        '  CMD="$CMD --no-default-features"',
        "fi",
        'eval "$CMD"',
      ].join("\n"),
      shell: "bash",
    },
  ],

  getExportSteps: (_ctx: StrategyContext, target: TargetMetadata): AbstractStep[] => {
    const steps: AbstractStep[] = [];

    // 1. Preparation (both branches emitted; runtime gated by artifact_type)
    steps.push({
      type: "shell",
      name: "Prepare Binary",
      if: "matrix.artifact_type == 'bin'",
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

    steps.push({
      type: "shell",
      name: "Prepare Library",
      if: "matrix.artifact_type == 'lib'",
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
        'copy_lib "$SRCDIR/lib${NAME}.so" "lib${NAME}.so" "${OUT}.so"',
        'copy_lib "$SRCDIR/lib${NAME}.dylib" "lib${NAME}.dylib" "${OUT}.dylib"',
        'copy_lib "$SRCDIR/lib${NAME}.a" "lib${NAME}.a" "${OUT}.a"',
        'copy_lib "$SRCDIR/${NAME}.dll" "${NAME}.dll" "${OUT}.dll"',
        'copy_lib "$SRCDIR/${NAME}.lib" "${NAME}.lib" "${OUT}.lib"',
        'copy_lib "$SRCDIR/lib${NAME}.dll.a" "lib${NAME}.dll.a" "${OUT}.dll.a"',
        'copy_lib "$SRCDIR/${NAME}.wasm" "${NAME}.wasm" "${OUT}.wasm"',
        "",
        `if [ "${target.headers}" = "true" ]; then`,
        '  if [ -f "cbindgen.toml" ]; then',
        '    cbindgen --config cbindgen.toml --crate "${NAME}" --output "$DSTDIR/${OUT}.h"',
        "  else",
        '    cbindgen --crate "${NAME}" --output "$DSTDIR/${OUT}.h"',
        "  fi",
        "fi",
      ].join("\n"),
      shell: "bash",
    });

    if (target.includeFiles.length > 0) {
      steps.push({
        type: "shell",
        name: "Copy Extra Files",
        run: `for f in ${target.includeFiles.join(" ")}; do\n  if [ -f "$f" ]; then\n    cp "$f" "target/release/"\n  fi\ndone`,
        shell: "bash",
      });
    }

    // 2. Export (both branches emitted)
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
      if: "matrix.artifact_type == 'lib' && (matrix.has_bin || !matrix.has_archive)",
      run: `mkdir -p _packages\ncp target/release/${target.outputName}.* _packages/ 2>/dev/null || true`,
      shell: "bash",
    });

    // 3. Packaging (both branches emitted)
    steps.push({
      type: "shell",
      name: "Package Binary",
      if: "matrix.artifact_type == 'bin' && matrix.has_archive",
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
        `if [ "${target.os}" = "windows" ]; then`,
        `  (cd "$STAGING_DIR" && 7z a -tzip "$ARCHIVE_DIR/${target.outputName}.zip" .) > /dev/null`,
        "else",
        `  tar -czf "$ARCHIVE_DIR/${target.outputName}.tar.gz" -C "$STAGING_DIR" .`,
        "fi",
      ].join("\n"),
      shell: "bash",
    });

    steps.push({
      type: "shell",
      name: "Package Library",
      if: "matrix.artifact_type == 'lib' && matrix.has_archive",
      run: [
        'ARCHIVE_DIR="${PWD}/_packages"',
        'mkdir -p "$ARCHIVE_DIR"',
        `STAGING_DIR="target/archive_staging/${target.outputName}"`,
        'mkdir -p "$STAGING_DIR"',
        `cp target/release/lib${target.artifactBin}.* "$STAGING_DIR/" 2>/dev/null || true`,
        `cp target/release/${target.artifactBin}.* "$STAGING_DIR/" 2>/dev/null || true`,
        `cp target/release/${target.outputName}.* "$STAGING_DIR/" 2>/dev/null || true`,
        `for f in ${target.includeFiles.join(" ")}; do`,
        '  if [ -f "$f" ]; then',
        '    cp "$f" "$STAGING_DIR/"',
        "  fi",
        "done",
        `if [ "${target.os}" = "windows" ]; then`,
        `  (cd "$STAGING_DIR" && 7z a -tzip "$ARCHIVE_DIR/${target.outputName}.zip" .) > /dev/null`,
        "else",
        `  tar -czf "$ARCHIVE_DIR/${target.outputName}.tar.gz" -C "$STAGING_DIR" .`,
        "fi",
      ].join("\n"),
      shell: "bash",
    });

    // 4. Platform-specific packagers (included unconditionally; runtime filtering via matrix flags)

    steps.push({
      type: "builtin",
      builtin: "install_tool",
      name: "Install cargo-deb",
      with: { tool: "cargo-deb" },
    });

    steps.push({
      type: "shell",
      name: "Build .deb package",
      run: [
        "mkdir -p _packages",
        `cargo deb --target ${target.triple} --no-build -o _packages/`,
        "for f in _packages/*.deb; do",
        `  [ -f "$f" ] && mv "$f" "_packages/${target.outputName}.deb"`,
        "done",
      ].join("\n"),
      shell: "bash",
    });

    steps.push({
      type: "builtin",
      builtin: "install_tool",
      name: "Install cargo-generate-rpm",
      with: { tool: "cargo-generate-rpm" },
    });

    steps.push({
      type: "shell",
      name: "Build .rpm package",
      run: [
        "mkdir -p _packages",
        "cargo generate-rpm -o _packages/",
        "for f in _packages/*.rpm; do",
        `  [ -f "$f" ] && mv "$f" "_packages/${target.outputName}.rpm"`,
        "done",
      ].join("\n"),
      shell: "bash",
    });

    steps.push({
      type: "builtin",
      builtin: "install_tool",
      name: "Install cargo-wix",
      with: { tool: "cargo-wix" },
    });

    steps.push({
      type: "shell",
      name: "Build .msi package",
      run: [
        "if (!(Test-Path _packages)) { New-Item -ItemType Directory -Path _packages }",
        `cargo wix --target ${target.triple} -o _packages/`,
        `$msi = Get-ChildItem "_packages\\*.msi" | Select-Object -First 1`,
        `if ($msi) { Rename-Item -Path $msi.FullName -NewName "${target.outputName}.msi" }`,
      ].join("\n"),
      shell: "pwsh",
    });

    return steps;
  },

  getTargetInfo: (os: string, arch: string, abi?: string) => RustTargets.find({ os, arch, abi }),

  getBuildEnv: (config) => {
    const cfg = config as Record<string, unknown>;
    const release = cfg["release"] as Record<string, unknown> | undefined;
    if (!release) {
      return {};
    }
    const env: Record<string, string> = {};
    if (release["strip"]) {
      env["CARGO_PROFILE_RELEASE_STRIP"] = "symbols";
    }
    if (release["lto"]) {
      env["CARGO_PROFILE_RELEASE_LTO"] = "true";
    }
    if (release["codegenUnits"] && (release["codegenUnits"] as number) > 0) {
      env["CARGO_PROFILE_RELEASE_CODEGEN_UNITS"] = String(release["codegenUnits"]);
    }
    if (release["panic"] === "abort") {
      env["CARGO_PROFILE_RELEASE_PANIC"] = "abort";
    }
    return env;
  },
};
