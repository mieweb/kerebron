# Copilot Instructions for Kerebron

## Project Overview

Kerebron is a ProseMirror-based online editor kit that provides a modular, extensible framework for building rich text editors. The project uses a monorepo structure to keep multiple ProseMirror forks in sync and avoid version incompatibilities.

**Key Points:**
- Framework-agnostic core (vanilla JS/TypeScript)
- Extension-based architecture inspired by Tiptap
- Built with Deno for simplified tooling
- Uses Rust for WebAssembly modules
- Pre-1.0: Code layout and naming conventions are still evolving

## Technology Stack

- **Runtime**: Deno
- **Language**: TypeScript
- **WASM**: Rust (for native modules)
- **Frameworks** (examples/extensions only): Vue, React, Vite, Meteor
- **Package Manager**: Deno workspaces
- **Build Tool**: DNT (Deno Node Transform) for npm package generation

## Project Structure

```
packages/          # Core packages and extensions
├── editor/        # Core editor package
├── editor-kits/   # Editor kits
├── extension-*/   # Various editor extensions
├── odt-wasm/      # ODT WebAssembly module
└── wasm/          # General WebAssembly utilities

examples/          # Example implementations
├── browser-*/     # Browser-based examples
├── cli-*/         # CLI tools
└── server-*/      # Server-side implementations
```

## Code Style & Standards

<!-- https://github.com/mieweb/template-mieweb-opensource/blob/main/.github/copilot-instructions.md -->

### 🎯 DRY (Don't Repeat Yourself)
- **Never duplicate code**: If you find yourself copying code, extract it into a reusable function
- **Single source of truth**: Each piece of knowledge should have one authoritative representation
- **Refactor mercilessly**: When you see duplication, eliminate it immediately
- **Shared utilities**: Common patterns should be abstracted into utility functions

### 💋 KISS (Keep It Simple, Stupid)
- **Simple solutions**: Prefer the simplest solution that works
- **Avoid over-engineering**: Don't add complexity for hypothetical future needs
- **Clear naming**: Functions and variables should be self-documenting
- **Small functions**: Break down complex functions into smaller, focused ones
- **Readable code**: Code should be obvious to understand at first glance

### 🧹 Folder Philosophy
- **Clear purpose**: Every folder should have a main thing that anchors its contents.
- **No junk drawers**: Don’t leave loose files without context or explanation.
- **Explain relationships**: If it’s not elegantly obvious how files fit together, add a README or note.
- **Immediate clarity**: Opening a folder should make its organizing principle clear at a glance.

### 🔄 Refactoring Guidelines
- **Continuous improvement**: Refactor as you work, not as a separate task
- **Safe refactoring**: Always run tests before and after refactoring
- **Incremental changes**: Make small, safe changes rather than large rewrites
- **Preserve behavior**: Refactoring should not change external behavior
- **Code reviews**: All refactoring should be reviewed for correctness

### ⚰️ Dead Code Management
- **Immediate removal**: Delete unused code immediately when identified
- **Historical preservation**: Move significant dead code to `.attic/` directory with context
- **Documentation**: Include comments explaining why code was moved to attic
- **Regular cleanup**: Review and clean attic directory periodically
- **No accumulation**: Don't let dead code accumulate in active codebase

## HTML & CSS Guidelines
- **Semantic Naming**: Every `<div>` and other structural element must use a meaningful, semantic class name that clearly indicates its purpose or role within the layout.
- **CSS Simplicity**: Styles should avoid global resets or overrides that affect unrelated components or default browser behavior. Keep changes scoped and minimal.
- **SASS-First Approach**: All styles should be written in SASS (SCSS) whenever possible. Each component should have its own dedicated SASS file to promote modularity and maintainability.

## Accessibility (ARIA Labeling)

### 🎯 Interactive Elements
- **All interactive elements** (buttons, links, forms, dialogs) must include appropriate ARIA roles and labels
- **Use ARIA attributes**: Implement aria-label, aria-labelledby, and aria-describedby to provide clear, descriptive information for screen readers
- **Semantic HTML**: Use semantic HTML wherever possible to enhance accessibility

### 📢 Dynamic Content
- **Announce updates**: Ensure all dynamic content updates (modals, alerts, notifications) are announced to assistive technologies using aria-live regions
- **Maintain tab order**: Maintain logical tab order and keyboard navigation for all features
- **Visible focus**: Provide visible focus indicators for all interactive elements

## Internationalization (I18N)

### 🌍 Text and Language Support
- **Externalize text**: All user-facing text must be externalized for translation
- **Multiple languages**: Support multiple languages, including right-to-left (RTL) languages such as Arabic and Hebrew
- **Language selector**: Provide a language selector for users to choose their preferred language

### 🕐 Localization
- **Format localization**: Ensure date, time, number, and currency formats are localized based on user settings
- **UI compatibility**: Test UI layouts for text expansion and RTL compatibility
- **Unicode support**: Use Unicode throughout to support international character sets

## Documentation Preferences

### Diagrams and Visual Documentation
- **Always use Mermaid diagrams** instead of ASCII art for workflow diagrams, architecture diagrams, and flowcharts
- **Use memorable names** instead of single letters in diagrams (e.g., `Engine`, `Auth`, `Server` instead of `A`, `B`, `C`)
- Use appropriate Mermaid diagram types:
  - `graph TB` or `graph LR` for workflow architectures 
  - `flowchart TD` for process flows
  - `sequenceDiagram` for API interactions
  - `gitgraph` for branch/release strategies
- Include styling with `classDef` for better visual hierarchy
- Add descriptive comments and emojis sparingly for clarity

### Documentation Standards
- Keep documentation DRY (Don't Repeat Yourself) - reference other docs instead of duplicating
- Use clear cross-references between related documentation files
- Update the main architecture document when workflow structure changes

## Working with GitHub Actions Workflows

### Development Philosophy
- **Script-first approach**: All workflows should call scripts that can be run locally
- **Local development parity**: Developers should be able to run the exact same commands locally as CI runs
- **Simple workflows**: GitHub Actions should be thin wrappers around scripts, not contain complex logic
- **Easy debugging**: When CI fails, developers can reproduce the issue locally by running the same script

### 📝 Formatting & Linting
- **Single quotes** for strings
- Run `deno fmt` before committing
- Excluded from formatting: `**/*.md`, `**/*.odt.xml`, `**/*.xml`
- Run `deno lint` before submitting PRs
- Excluded rules: `no-explicit-any`, `prefer-const`, `no-unused-vars`
- Excluded directories: `examples/server-cloudflare-worker`

### ✅ Testing
- Run `deno test` (currently: `deno test --no-check` as WIP)
- Tests should pass before PR submission

## Development Guidelines

### Core Principles
1. **Keep the core framework-agnostic** - vanilla JS/TS only in core packages
2. **Framework-specific code belongs in extensions or examples** - Vue, React, etc.
3. **Maintain compatibility** - The monorepo exists to prevent version conflicts
4. **Pre-1.0 flexibility** - Don't make code worse, but perfection isn't expected yet

### Working with Packages
- All packages use Deno workspaces defined in root `deno.json`
- Import from workspace packages using their package names
- Use `jsr:` or `npm:` prefixes for external dependencies

### Building
- **Build all**: `deno task build`
- **Build WASM extensions**: `deno task build:ext-wasm`
- **Build ODT**: `deno task build:ext-odt`
- **Build NPM packages**: Use `./scripts/build-and-publish-npm.sh <version>` (NOT `deno run -A build/build_npm.ts` directly)
  - This script builds WASM dependencies first, which are required before the npm build
  - Example: `./scripts/build-and-publish-npm.sh 1.0.0` for dry run
  - Example: `./scripts/build-and-publish-npm.sh 1.0.0 --publish` to publish to npm

### Running Examples
- **Dev server**: `deno task -f server-deno-hono start` - **ALWAYS start this first!**
  - Runs on `http://localhost:8000`
  - Serves all examples (Vue, React, vanilla) at their respective paths
  - Provides backend services: Yjs WebSocket, LSP, WASM files, API endpoints
  - **Never run individual example dev servers separately** - they depend on the Hono backend
- Each example has its own `deno.json` but should be accessed via the Hono server
- Example URLs after starting the server:
  - Vue: `http://localhost:8000/examples/browser-vue/`
  - React: `http://localhost:8000/examples/browser-react/`
  - Vanilla: `http://localhost:8000/examples/browser-vanilla-code-editor/`

## Extension Development

When creating or modifying extensions:
1. Follow the extension pattern in existing `packages/extension-*` folders
2. Extensions should be opt-in and modular
3. Keep dependencies minimal
4. Include a `README.md` with usage examples
5. Export clean, documented APIs

## Common Patterns

### Import Style
```typescript
// External NPM packages (from root deno.json imports)
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

// Workspace packages
import { Editor } from '@kerebron/editor';
```

### File Organization
- `src/` - Source code
- `test/` - Tests (if applicable)
- `assets/` - Static assets
- `deno.json` - Package configuration

## NPM Package Generation

Kerebron uses DNT (Deno Node Transform) to generate hybrid npm modules supporting both ESM and CommonJS:
- Build script: `build/build_npm.ts`
- Generates packages compatible with Node.js ecosystem
- Maintains Deno-first development experience

## Docker Development

```bash
docker build . -t editor-test
docker run -it -p 8000:8000 -v $PWD:/usr/src/app editor-test
```

## Important Notes

- **WIP Status**: Some tests may fail, structure may change
- **Focus on ProseMirror compatibility**: Primary goal is keeping dependencies in sync
- **No unnecessary wrappers**: Direct use of ProseMirror where possible
- **Fewer dependencies**: Prefer built-in Deno/Web APIs

## Resources

- [Deno Documentation](https://deno.land/manual)
- [ProseMirror Guide](https://prosemirror.net/docs/guide/)
- [DNT Documentation](https://github.com/denoland/dnt)
- [Playground Demo](https://demo.kerebron.com)

## When Generating Code

### 🪶 Pull Request Philosophy
* **Smallest viable change**: Always make the smallest change that fully solves the problem
* **Fewest files first**: Start with the minimal number of files required
* **No sweeping edits**: Broad refactors or multi-module changes must be split or proposed as new components
* **Isolated improvements**: If a change grows complex, extract it into a new function, module, or component instead of modifying multiple areas
* **Direct requests only**: Large refactors or architectural shifts should only occur when explicitly requested

### Code Quality Checklist
- [ ] **DRY**: No code duplication - extracted reusable functions?
- [ ] **KISS**: Simplest solution that works?
- [ ] **Minimal Changes**: Smallest viable change made for PR?
- [ ] **Naming**: Self-documenting function/variable names?
- [ ] **Size**: Functions small and focused?
- [ ] **Dead Code**: Removed or archived appropriately?
- [ ] **Accessibility**: ARIA labels and semantic HTML implemented?
- [ ] **I18N**: User-facing text externalized for translation?
- [ ] **TypeScript**: Using TypeScript with Deno conventions?
- [ ] **Single quotes**: Used for all strings?
- [ ] **Formatting**: Code formatted with `deno fmt`?
- [ ] **Linting**: Code passes `deno lint`?
- [ ] **Testing**: Tests pass with `deno test`?
- [ ] **Framework independence**: No framework dependencies in core packages?
- [ ] **Deno imports**: Using jsr:, npm:, or https: imports?
- [ ] **Documentation**: Public APIs documented with JSDoc comments?
- [ ] **ProseMirror compatibility**: Tested with existing ProseMirror modules?



