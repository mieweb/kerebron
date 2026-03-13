## Contributing Guidelines

1. BEFORE EVERYTHING else install git hooks with `deno task postinstall`

2. All commits must follow Conventional Commits: <type>(<scope>): <short description> (e.g., feat(ui): add dark mode) and avoid trivial messages like fix: typo.
   This ensures proper release changelog.

3. Use fixup/squash to combine commits when needed. See https://mikulskibartosz.name/git-fixup-explained for guidance

Code layout, names are unstable pre-1.0.
Some things like tests might still fail.
For now do not make code worse.

This software is done with typescript + deno + rust (for wasm modules).

The editor should be usable in vanilla JS, framework-agnostic.
Some extensions and examples are done with vue, vite, meteor, etc. Because we use the editor with different projects.
That is extension not something necessary to run the core.
