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
