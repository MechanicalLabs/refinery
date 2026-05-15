# refinery
[![CI](https://github.com/MechanicalLabs/refinery/actions/workflows/ci.yml/badge.svg)](https://github.com/MechanicalLabs/refinery/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**High-performance, native-first build orchestrator for CI/CD.**

---

`refinery` is a portable build engine that strips the boilerplate out of multi-platform CI/CD. It abstracts complex build logic into a single `refinery.toml` blueprint, generating platform-specific workflows.

## Features
* **Native-First:** No Docker, Cross, or Zig overhead. Uses native linkers and host-system toolchains for raw performance.
* **CI Agnostic:** Write your build logic once. Export using GitHub Actions, GitLab CI, or CircleCI.
* **Just-in-Time Setup:** Only installs the exact toolchains and dependencies required for the specific matrix job.
* **Unified Naming:** Use standardized architecture names (`arm64`, `x86_64`) and let Refinery map them to complex toolchain triples automatically.
* **Type-Safe:** Driven by strict Zod schemas and the [ripthrow](https://github.com/MechanicalLabs/ripthrow) error handling pattern.

## Why Refinery?
Because traditional CI workflows are **tedious, fragile, and slow.** Managing matrices for cross-compilation usually involves copy-pasting hundreds of lines of YAML that are impossible to test locally and a nightmare to debug.

`refinery` lets you:
* **Bypass YAML Hell:** Define artifacts and targets in clean, validated TOML.
* **Consolidate Logic:** Keep your build secrets, hooks, and packaging logic in one place.
* **Scale Effortlessly:** Add a new architecture or OS with two lines of configuration.

> "The bottleneck should always be your compiler, not your orchestrator."

## Quick Start
```bash
# Get the refinery binary (coming soon)
# curl -sSf https://refinery.sh/install.sh | sh

# Initialize your project
refinery init
```

```toml
# refinery.toml
version = 1
lang = "rust"
platform = "github"

[[artifacts]]
name = "server"
type = "bin"
outputName = "server-{os}-{arch}"

[[targets]]
id = "linux-stable"
for = "server"
type = "bin"
os = "linux"
arch = ["x86_64", "arm64"]
packages = ["tar.gz", "deb"]
```

## Reliability & Safety
* **Panic-Free:** Built with `ripthrow` to ensure errors are handled as values, not explosive exceptions.
* **Validation:** Every `refinery.toml` is validated against a strict Zod schema before a single command is run.
* **Reproducible:** Hardcodes toolchain versions and refinery engines to prevent "it worked yesterday" regressions.
