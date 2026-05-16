// biome-ignore-all lint/suspicious/noTemplateCurlyInString: GHA
// biome-ignore-all lint/style/useNamingConvention: GHA env vars and config keys

import { PACKAGERS, type PackageStep } from "../../packaging";
import { Actions } from "./constants";

interface Step {
  name: string;
  uses?: string;
  run?: string;
  shell?: string;
  with?: Record<string, string | boolean>;
  env?: Record<string, string>;
  if?: string;
}

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
      name: "Install MinGW (Windows GNU)",
      if: "runner.os == 'Windows' && matrix.abi == 'gnu'",
      run: `choco install mingw -y
Add-Content $env:GITHUB_PATH "C:\\ProgramData\\mingw64\\mingw64\\bin"
if ("\${{ matrix.arch }}" -eq "x86") {
  $url = "https://github.com/niXman/mingw-builds-binaries/releases/download/15.2.0-rt_v13-rev0/i686-15.2.0-release-posix-dwarf-ucrt-rt_v13-rev0.7z"
  $archive = "$env:TEMP\\mingw-i686.7z"
  Invoke-WebRequest -Uri $url -OutFile $archive
  7z x $archive -o"C:\\ProgramData\\mingw-i686" -y | Out-Null
  Add-Content $env:GITHUB_PATH "C:\\ProgramData\\mingw-i686\\mingw32\\bin"
}`,
      shell: "powershell",
    },
  ];
}

function buildCompilationSteps(): Step[] {
  return [
    {
      name: "Install Target",
      run: "rustup target add ${{ matrix.target_triple }}",
      shell: "bash",
    },
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
      run: 'SRC="target/${{ matrix.target_triple }}/release/${{ matrix.artifact_bin }}${{ matrix.bin_ext }}"\nDST_ORIG="target/release/${{ matrix.artifact_bin }}${{ matrix.bin_ext }}"\nDST_RENAMED="target/release/${{ matrix.output_name }}${{ matrix.bin_ext }}"\n\nmkdir -p target/release\ncp "$SRC" "$DST_ORIG"\ncp "$SRC" "$DST_RENAMED"',
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
      if: "${{ matrix.has_bin }}",
      run: 'mkdir -p _packages\ncp "target/release/${{ matrix.output_name }}${{ matrix.bin_ext }}" "_packages/"',
      shell: "bash",
    },
  ];
}

function buildArchiveSteps(): Step[] {
  return [
    {
      name: "Package",
      if: "${{ matrix.has_archive }}",
      run: 'ARCHIVE_DIR="${PWD}/_packages"\nmkdir -p "$ARCHIVE_DIR"\nSTAGING_DIR="target/archive_staging/${{ matrix.output_name }}"\nmkdir -p "$STAGING_DIR"\ncp "target/release/${{ matrix.output_name }}${{ matrix.bin_ext }}" "$STAGING_DIR/"\nfor f in ${{ join(matrix.include_files, \' \') }}; do\n  if [ -f "$f" ]; then\n    cp "$f" "$STAGING_DIR/"\n  fi\ndone\n\nif [ "${{ matrix.package_type }}" = "zip" ]; then\n  (cd "$STAGING_DIR" && 7z a -tzip "$ARCHIVE_DIR/${{ matrix.output_name }}.zip" .) > /dev/null\nelse\n  tar -czf "$ARCHIVE_DIR/${{ matrix.output_name }}.tar.gz" -C "$STAGING_DIR" .\nfi',
      shell: "bash",
    },
  ];
}

function buildUploadSteps(): Step[] {
  return [
    {
      name: "Upload Artifact",
      uses: Actions.uploadArtifact,
      with: {
        name: "${{ matrix.output_name }}",
        path: "_packages/",
      },
    },
  ];
}

function buildSteps(): Step[] {
  return [
    { name: "Checkout", uses: Actions.checkout },
    { name: "Setup Rust", uses: Actions.setupRust },
    ...buildSystemDependenciesSteps(),
    ...buildCompilationSteps(),
    ...buildPreparationSteps(),
    ...buildPackagingSteps(),
    ...buildBinarySteps(),
    ...buildArchiveSteps(),
    ...buildUploadSteps(),
  ];
}

export { buildSteps };
