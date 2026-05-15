// biome-ignore lint/nursery/noExcessiveLinesPerFile: generated YAML mapping is verbose
import { dump } from "js-yaml";
import type { RefineryConfig } from "../../schema";
import { Actions } from "./constants";

const DEFAULT_OUTPUT_PATTERN = "{name}-{os}-{arch}";
const TRAILING_DASH_RE = /-$/u;

function getRunsOn(os: string, arch: string): string {
  if (arch === "arm64") {
    if (os === "linux") {
      return "ubuntu-24.04-arm";
    }
    if (os === "windows") {
      return "windows-11-arm";
    }
  }
  if (os === "linux") {
    return "ubuntu-latest";
  }
  if (os === "macos") {
    return "macos-latest";
  }
  if (os === "windows") {
    return "windows-latest";
  }
  return "ubuntu-latest";
}

function getAbiDefault(os: string, abi: string | undefined): string | undefined {
  if (abi !== undefined) {
    return abi;
  }
  if (os !== "windows") {
    return;
  }
  return "msvc";
}

function getAbiKey(os: string, abi: string | undefined): string | undefined {
  const resolved = getAbiDefault(os, abi);
  if (resolved === undefined) {
    return;
  }
  if (os === "linux" && resolved === "gnu") {
    return;
  }
  if (os === "windows" && resolved === "msvc") {
    return;
  }
  return resolved;
}

const TRIPLES: Record<string, string> = Object.fromEntries([
  ["linux/x86_64", "x86_64-unknown-linux-gnu"],
  ["linux/x86_64:musl", "x86_64-unknown-linux-musl"],
  ["linux/arm64", "aarch64-unknown-linux-gnu"],
  ["linux/arm64:musl", "aarch64-unknown-linux-musl"],
  ["linux/x86", "i686-unknown-linux-gnu"],
  ["linux/armv7", "armv7-unknown-linux-gnueabihf"],
  ["macos/x86_64", "x86_64-apple-darwin"],
  ["macos/arm64", "aarch64-apple-darwin"],
  ["windows/x86_64", "x86_64-pc-windows-msvc"],
  ["windows/x86_64:gnu", "x86_64-pc-windows-gnu"],
  ["windows/arm64", "aarch64-pc-windows-msvc"],
  ["windows/x86", "i686-pc-windows-msvc"],
  ["windows/x86:gnu", "i686-pc-windows-gnu"],
]);

function getTargetTriple(os: string, arch: string, abi?: string): string {
  const abiKey = getAbiKey(os, abi);
  let key: string;
  if (abiKey === undefined) {
    key = `${os}/${arch}`;
  } else {
    key = `${os}/${arch}:${abiKey}`;
  }
  return TRIPLES[key] ?? "x86_64-unknown-linux-gnu";
}

function getPackageType(os: string): string {
  if (os === "windows") {
    return "zip";
  }
  return "tar.gz";
}

interface MatrixEntry {
  artifact: string;
  os: string;
  arch: string;
  // biome-ignore lint/style/useNamingConvention: YAML output key
  runs_on: string;
  // biome-ignore lint/style/useNamingConvention: YAML output key
  output_name: string;
  // biome-ignore lint/style/useNamingConvention: YAML output key
  artifact_bin: string;
  // biome-ignore lint/style/useNamingConvention: YAML output key
  target_triple: string;
  // biome-ignore lint/style/useNamingConvention: YAML output key
  package_type: string;
}

interface Step {
  name: string;
  uses?: string;
  run?: string;
  shell?: string;
  with?: Record<string, string>;
  env?: Record<string, string>;
  if?: string;
}

const EXPRESSION_EXT = `\${{ runner.os == 'Windows' && '.exe' || '' }}`;

function resolveOutputPattern(
  pattern: string,
  vars: { name: string; os: string; arch: string; abi: string | undefined },
): string {
  let result = pattern;
  result = result.replace("{name}", vars.name);
  result = result.replace("{os}", vars.os);
  result = result.replace("{arch}", vars.arch);
  result = result.replace("{abi}", vars.abi ?? "");
  result = result.replace(TRAILING_DASH_RE, "");
  return result;
}

function buildPatternMap(config: RefineryConfig): Map<string, string> {
  const map = new Map<string, string>();
  if (config.lang !== "rust") {
    return map;
  }
  for (const artifact of config.artifacts ?? []) {
    if (artifact.type === "bin" && artifact.outputName) {
      map.set(artifact.name, artifact.outputName);
    }
  }
  return map;
}

function resolveName(
  pattern: string,
  vars: { artifact: string; os: string; arch: string; abi: string | undefined },
): string {
  const resolved = resolveOutputPattern(pattern, {
    name: vars.artifact,
    os: vars.os,
    arch: vars.arch,
    abi: vars.abi,
  });
  if (resolved !== vars.artifact) {
    return resolved;
  }
  return `${resolved}-${vars.os}-${vars.arch}`;
}

function buildMatrix(config: RefineryConfig): MatrixEntry[] {
  const entries: MatrixEntry[] = [];
  const patterns = buildPatternMap(config);

  for (const target of config.targets ?? []) {
    for (const arch of target.arch) {
      const pattern = patterns.get(target.for) ?? DEFAULT_OUTPUT_PATTERN;
      const outputName = resolveName(pattern, {
        artifact: target.for,
        os: target.os,
        arch,
        abi: target.abi,
      });

      entries.push({
        artifact: target.for,
        os: target.os,
        arch,
        // biome-ignore lint/style/useNamingConvention: YAML output key
        runs_on: getRunsOn(target.os, arch),
        // biome-ignore lint/style/useNamingConvention: YAML output key
        output_name: outputName,
        // biome-ignore lint/style/useNamingConvention: YAML output key
        artifact_bin: target.for.replace(/-/gu, "_"),
        // biome-ignore lint/style/useNamingConvention: YAML output key
        target_triple: getTargetTriple(target.os, arch, target.abi),
        // biome-ignore lint/style/useNamingConvention: YAML output key
        package_type: getPackageType(target.os),
      });
    }
  }
  return entries;
}

function buildReleaseEnv(config: RefineryConfig): Record<string, string> | undefined {
  if (config.lang !== "rust") {
    return;
  }
  const { release } = config;
  if (!release) {
    return;
  }
  const env: Record<string, string> = {};
  if (release.strip) {
    // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature
    env["CARGO_PROFILE_RELEASE_STRIP"] = "symbols";
  }
  if (release.lto) {
    // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature
    env["CARGO_PROFILE_RELEASE_LTO"] = "true";
  }
  if (release.codegenUnits && release.codegenUnits > 0) {
    // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature
    env["CARGO_PROFILE_RELEASE_CODEGEN_UNITS"] = String(release.codegenUnits);
  }
  if (release.panic === "abort") {
    // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature
    env["CARGO_PROFILE_RELEASE_PANIC"] = "abort";
  }
  return env;
}

function buildSteps(config: RefineryConfig): Step[] {
  const buildEnv = buildReleaseEnv(config);

  const buildStep: Step = {
    name: "Build",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression
    run: "cargo build --release --target ${{ matrix.target_triple }}",
    shell: "bash",
  };
  if (buildEnv) {
    buildStep.env = buildEnv;
  }

  return [
    { name: "Checkout", uses: Actions.checkout },
    { name: "Setup Rust", uses: Actions.setupRust },
    {
      name: "Install Target",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression
      run: "rustup target add ${{ matrix.target_triple }}",
      shell: "bash",
    },
    buildStep,
    {
      name: "Prepare Binary",
      run: `EXT="${EXPRESSION_EXT}"
SRC="target/\${{ matrix.target_triple }}/release/\${{ matrix.artifact_bin }}\${EXT}"
DST="target/release/\${{ matrix.output_name }}\${EXT}"

cp "\${SRC}" "\${DST}"
echo "FINAL_BINARY_PATH=\${DST}" >> $GITHUB_ENV`,
      shell: "bash",
    },
    {
      name: "Package",
      run: `DST="\${{ env.FINAL_BINARY_PATH }}"
if [ "\${{ matrix.package_type }}" = "zip" ]; then
  ARCHIVE="\${DST}.zip"
  (cd "$(dirname "\${DST}")" && 7z a -tzip "$(basename "\${DST}").zip" "$(basename "\${DST}")") > /dev/null
else
  ARCHIVE="\${DST}.tar.gz"
  tar -czf "\${ARCHIVE}" -C "$(dirname "\${DST}")" "$(basename "\${DST}")"
fi
echo "FINAL_BINARY_PATH=\${ARCHIVE}" >> $GITHUB_ENV`,
      shell: "bash",
    },
    {
      name: "Upload Artifact",
      uses: Actions.uploadArtifact,
      with: {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression
        name: "${{ matrix.output_name }}",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression
        path: "${{ env.FINAL_BINARY_PATH }}",
      },
    },
  ];
}

export function buildWorkflowYaml(config: RefineryConfig): string {
  const matrix = buildMatrix(config);

  const workflow = {
    name: "Refinery Build",
    on: {
      push: { tags: ["v*"] },
      release: { types: ["created"] },
    },
    jobs: {
      build: {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression
        name: "${{ matrix.artifact }} (${{ matrix.os }}-${{ matrix.arch }})",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression
        "runs-on": "${{ matrix.runs_on }}",
        strategy: {
          "fail-fast": true,
          matrix: { include: matrix },
        },
        steps: buildSteps(config),
      },
      release: {
        name: "Release Artifacts",
        needs: ["build"],
        "runs-on": "ubuntu-latest",
        if: "startsWith(github.ref, 'refs/tags/')",
        permissions: {
          contents: "write",
        },
        steps: [
          {
            name: "Download Artifacts",
            uses: Actions.downloadArtifact,
            with: {
              "merge-multiple": true,
              path: "./artifacts",
            },
          },
          {
            name: "Display structure",
            run: "find ./artifacts -type f | sort",
            shell: "bash",
          },
          {
            name: "Publish Release",
            uses: Actions.ghRelease,
            with: {
              // biome-ignore lint/style/useNamingConvention: YAML output key
              fail_on_unmatched_files: true,
              files: "./artifacts/*",
            },
            env: {
              // biome-ignore lint/style/useNamingConvention: GitHub env var
              GITHUB_TOKEN:
                // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression
                "${{ secrets.GITHUB_TOKEN }}",
            },
          },
        ],
      },
    },
  };

  return dump(workflow, { lineWidth: 120, noRefs: true, quotingType: '"' });
}
