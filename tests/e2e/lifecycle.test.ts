import { beforeAll, describe, expect, it } from "bun:test";
import { ensureImageBuilt, runInIsolatedDocker } from "./harness";

const DOCKER_BUILD_TIMEOUT = 120_000;
const E2E_FLOW_TIMEOUT = 30_000;

describe("CLI E2E Lifecycle", () => {
  beforeAll(() => {
    ensureImageBuilt();
  }, DOCKER_BUILD_TIMEOUT);

  it("fails when manifest is missing", () => {
    const { output, exitCode } = runInIsolatedDocker(["check"]);
    expect(exitCode).not.toBe(0);
    expect(output).toContain("refinery.toml not found");
  });

  it("validates manual manifest creation", () => {
    const setup = [
      "echo 'version = 1' > refinery.toml",
      "echo 'lang = \"rust\"' >> refinery.toml",
      "echo 'platform = \"github\"' >> refinery.toml",
      "echo 'toolchain = \"stable\"' >> refinery.toml",
      "echo '[[artifacts]]' >> refinery.toml",
      "echo 'type = \"bin\"' >> refinery.toml",
      "echo 'name = \"app\"' >> refinery.toml",
      "echo '[[targets]]' >> refinery.toml",
      "echo 'id = \"linux\"' >> refinery.toml",
      "echo 'for = \"app\"' >> refinery.toml",
      "echo 'os = \"linux\"' >> refinery.toml",
      "echo 'arch = [\"x86_64\"]' >> refinery.toml",
      "echo 'type = \"bin\"' >> refinery.toml",
    ];
    const { output } = runInIsolatedDocker(["check"], setup);

    expect(output).toContain("refinery.toml is valid");
    expect(output).toContain("Checking toolchain");
  });

  it(
    "executes build dry-run",
    () => {
      const setup = [
        "touch Cargo.toml",
        "echo '[package]' > Cargo.toml",
        "echo 'name = \"test-pkg\"' >> Cargo.toml",
        "echo 'version = \"0.1.0\"' >> Cargo.toml",
        "mkdir src && touch src/main.rs",
        "echo 'version = 1' > refinery.toml",
        "echo 'lang = \"rust\"' >> refinery.toml",
        "echo 'platform = \"github\"' >> refinery.toml",
        "echo 'toolchain = \"stable\"' >> refinery.toml",
        "echo '[[artifacts]]' >> refinery.toml",
        "echo 'type = \"bin\"' >> refinery.toml",
        "echo 'name = \"test-pkg\"' >> refinery.toml",
        "echo '[[targets]]' >> refinery.toml",
        "echo 'id = \"linux\"' >> refinery.toml",
        "echo 'for = \"test-pkg\"' >> refinery.toml",
        "echo 'os = \"linux\"' >> refinery.toml",
        "echo 'arch = [\"x86_64\"]' >> refinery.toml",
        "echo 'type = \"bin\"' >> refinery.toml",
      ];

      const { output, exitCode } = runInIsolatedDocker(["build", "--dry-run"], setup);

      expect(output).toContain("Dry-run mode enabled");
      expect(output).toContain('CMD="cargo build --release"');
      expect(output).toContain('CMD="$CMD --target x86_64-unknown-linux-gnu"');
      expect(output).toContain("Dry-run complete");
      expect(exitCode).toBe(0);
    },
    E2E_FLOW_TIMEOUT,
  );
});
