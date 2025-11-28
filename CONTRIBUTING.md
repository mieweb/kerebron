# Contributing Guidelines

This document is WIP.
Code layout, names are unstable pre-1.0.
Some things like tests might still fail.
For now do not make code worse.

This software is done with typescript + deno + rust (for wasm modules).

The editor should be usable in vanilla JS, framework agnostic.
Some extensions and examples are done with vue, vite, meteor, etc. Because we use the editor with different projects.
That is extension not something necessary to run the core.

## Submitting a PR

1. `deno test` passes. WIP run: `deno test --no-check`
2. Run `deno fmt` - files can be excluded in: https://github.com/mieweb/kerebron/blob/main/deno.json `fmt.exclude`
3. Run `deno lint` WIP
4. If modifying frontend code, run Playwright tests (see below)

## Running Playwright Tests

Our CI uses the official Playwright Docker image for faster, more consistent browser testing. You can run tests locally in two ways:

### Option 1: Local Installation (Quick)

```bash
cd examples/browser-react
deno task playwright:install  # First time only
deno task test
```

### Option 2: Docker (Recommended - Matches CI)

Run tests inside the same Docker container used by CI for 100% environment consistency:

```bash
cd examples/browser-react
docker run --rm --network host -v $(pwd):/work -w /work \
  mcr.microsoft.com/playwright:v1.49.0-jammy \
  /bin/bash -c "deno task test"
```

See `examples/browser-react/TESTING.md` for more test options and details.
