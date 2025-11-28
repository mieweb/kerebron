# Building Kerebron from Source

This guide is for developers who want to contribute to Kerebron or test unreleased features.

## Prerequisites

### 1. Install Deno

Kerebron uses Deno for development tooling.

**macOS/Linux:**
```bash
curl -fsSL https://deno.land/install.sh | sh
```

**Windows (PowerShell):**
```powershell
irm https://deno.land/install.ps1 | iex
```

**Using npm:**
```bash
npm install -g deno
```

**Verify installation:**
```bash
deno --version
```

### 2. Install Rust

Required for building WebAssembly modules (ODT parser, etc.).

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Add the wasm32 target:
```bash
rustup target add wasm32-unknown-unknown
```

**Verify installation:**
```bash
rustc --version
cargo --version
```

## Clone and Build

### 1. Clone the Repository

```bash
git clone https://github.com/mieweb/kerebron.git
cd kerebron
```

### 2. Build WebAssembly Modules

Build all WASM extensions:

```bash
deno task build
```

This runs:
- `deno task build:ext-wasm` - Builds core WASM utilities
- `deno task build:ext-odt` - Builds ODT parser WebAssembly module

### 3. Start Development Server

```bash
deno task -f examples/server-deno-hono start
```

The server will start at `http://localhost:8000` with:
- All browser examples available at `/examples/`
- Documentation at `/`
- Yjs WebSocket server at `/yjs/:room`
- Optional LSP proxy at `/lsp/*`

### Available Examples

Once the server is running, visit:

- `http://localhost:8000/examples/browser-react/` - React example
- `http://localhost:8000/examples/browser-vue/` - Vue example
- `http://localhost:8000/examples/browser-vanilla-code-editor/` - Vanilla JS

## Project Structure

```
kerebron/
├── packages/
│   ├── editor/                    # Core editor package
│   ├── editor-kits/               # Pre-configured extension bundles
│   ├── extension-basic-editor/    # Basic editing features
│   ├── extension-menu/            # Toolbar menu
│   ├── extension-markdown/        # Markdown support
│   ├── extension-tables/          # Table support
│   ├── extension-yjs/             # Collaborative editing
│   ├── extension-lsp/             # Language server support
│   ├── extension-codemirror/      # Code editor
│   ├── extension-odt/             # ODT import/export
│   ├── odt-wasm/                  # ODT WebAssembly module
│   └── wasm/                      # Core WASM utilities
├── examples/
│   ├── browser-react/             # React example
│   ├── browser-vue/               # Vue example
│   ├── browser-vanilla-code-editor/ # Vanilla JS
│   └── server-deno-hono/          # Backend server
├── build/
│   └── build_npm.ts               # NPM package builder
└── deno.json                      # Workspace configuration
```

## Using Local Build in Your Project

### Option 1: Use Dev Server (Direct Import)

The easiest way to test local changes is to import directly from the running dev server:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Kerebron - Local Dev</title>
  <!-- Import CSS from local dev server -->
  <link rel="stylesheet" href="http://localhost:8000/packages/editor/assets/index.css">
  <link rel="stylesheet" href="http://localhost:8000/packages/extension-menu/assets/custom-menu.css">
</head>
<body>
  <h1>Testing Local Kerebron Build</h1>
  <div id="editor" class="kb-component"></div>

  <script type="module">
    // Import from local dev server instead of CDN
    import { CoreEditor } from 'http://localhost:8000/packages/editor/src/index.ts';
    import { AdvancedEditorKit } from 'http://localhost:8000/packages/editor-kits/src/AdvancedEditorKit.ts';

    const editor = new CoreEditor({
      element: document.querySelector('#editor'),
      extensions: [new AdvancedEditorKit()],
    });

    const content = '# Local Dev Test\n\nEditing with local build!';
    const buffer = new TextEncoder().encode(content);
    await editor.loadDocument('text/x-markdown', buffer);
  </script>
</body>
</html>
```

**Benefits:**
- See changes instantly (just refresh the browser)
- No build or install step needed
- Perfect for rapid prototyping and testing

**Requirements:**
- Dev server must be running: `deno task -f examples/server-deno-hono start`
- Your HTML file can be anywhere (doesn't need to be in the kerebron repo)

### Option 2: npm link

For integration into larger projects with build tools:

```bash
# In kerebron repository
cd packages/editor
npm link

cd ../extension-basic-editor
npm link

# In your project
cd /path/to/your/project
npm link @kerebron/editor
npm link @kerebron/extension-basic-editor
```

### Option 3: File Paths

In your project's `package.json`:

```json
{
  "dependencies": {
    "@kerebron/editor": "file:../kerebron/packages/editor",
    "@kerebron/extension-basic-editor": "file:../kerebron/packages/extension-basic-editor",
    "@kerebron/extension-menu": "file:../kerebron/packages/extension-menu",
    "@kerebron/editor-kits": "file:../kerebron/packages/editor-kits"
  }
}
```

Then run:
```bash
npm install
```

### Option 3: Deno Workspaces (for Deno projects)

If your project uses Deno, you can reference packages directly in `deno.json`:

```json
{
  "imports": {
    "@kerebron/editor": "../kerebron/packages/editor/src/index.ts",
    "@kerebron/extension-basic-editor": "../kerebron/packages/extension-basic-editor/src/index.ts"
  }
}
```

## Building NPM Packages

To generate npm packages from Deno source (for publishing):

```bash
deno -A ./build/build_npm.ts
```

This uses [DNT (Deno Node Transform)](https://github.com/denoland/dnt) to create:
- CommonJS + ESM hybrid modules
- TypeScript declarations
- Proper package.json for each package

Built packages are output to each package's `npm/` directory.

## Available Deno Tasks

View all tasks:
```bash
deno task
```

Common tasks:

```bash
# Build all WebAssembly modules
deno task build

# Build only WASM utilities
deno task build:ext-wasm

# Build only ODT parser
deno task build:ext-odt

# Start dev server (from server-deno-hono directory)
deno task -f examples/server-deno-hono start

# Start dev server without LSP
deno task -f examples/server-deno-hono start -- --without-lsp
```

## Development Workflow

### 1. Make Changes

Edit files in the relevant package under `packages/`.

### 2. Test Changes

If you modified WASM modules, rebuild:
```bash
deno task build
```

Restart the dev server:
```bash
deno task -f examples/server-deno-hono start
```

### 3. Test in Browser

Visit `http://localhost:8000/examples/browser-react/` (or other examples).

### 4. Run Tests

```bash
# Run all tests
deno test

# Run tests for specific package
cd packages/extension-basic-editor
deno test
```

## Docker Development

Build and run in Docker:

```bash
# Build image
docker build . -t kerebron-dev

# Run container
docker run -it -p 8000:8000 -v $PWD:/usr/src/app kerebron-dev
```

Access at `http://localhost:8000`.

## Contributing

### Before Submitting a PR

1. **Format code:**
   ```bash
   deno fmt
   ```

2. **Lint code:**
   ```bash
   deno lint
   ```

3. **Run tests:**
   ```bash
   deno test
   ```

4. **Check TypeScript:**
   ```bash
   deno check packages/*/src/*.ts
   ```

### Code Style

- Use single quotes for strings
- Follow Deno conventions
- Keep core packages framework-agnostic
- Add JSDoc comments for public APIs
- Include tests for new features

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed guidelines.

## Troubleshooting

### Rust Build Errors

Ensure you have the wasm32 target:
```bash
rustup target add wasm32-unknown-unknown
```

### WASM Module Not Loading

Rebuild WASM modules:
```bash
deno task build
```

### Port Already in Use

Kill the process using port 8000:
```bash
# macOS/Linux
lsof -ti:8000 | xargs kill -9

# Or change the port in server-deno-hono/src/main.ts
```

### Module Resolution Errors

Clear Deno cache:
```bash
deno cache --reload packages/*/src/*.ts
```

## Resources

- [Deno Documentation](https://deno.land/manual)
- [Deno Workspaces](https://deno.land/manual/basics/workspaces)
- [DNT (Deno Node Transform)](https://github.com/denoland/dnt)
- [Rust and WebAssembly](https://rustwasm.github.io/docs/book/)
- [Contributing Guidelines](../CONTRIBUTING.md)

## Next Steps

- **[Read Architecture Docs](../copilot-instructions.md)** - Understand the codebase
- **[Check Examples](../examples/)** - See implementation patterns
- **[Join Discussions](https://github.com/mieweb/kerebron/discussions)** - Ask questions
- **[Report Issues](https://github.com/mieweb/kerebron/issues)** - File bugs or feature requests
