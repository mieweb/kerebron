# Getting Started with Kerebron

Kerebron is a ProseMirror-based rich text editor kit that provides a modular, framework-agnostic approach to building collaborative editors.

## Choose Your Path

Select the guide that matches your setup:

### 🚀 Quick Start Guides (5 minutes)
- **[Quick Start with CDN](./01-quick-start.md)** - Try instantly in your browser, no installation!
- **[Vanilla JavaScript/TypeScript](./getting-started-vanilla.md)** - No framework, pure JS/TS (includes CDN option)
- **[React](./getting-started-react.md)** - Using React hooks and components
- **[Vue 3](./getting-started-vue.md)** - Using Vue 3 Composition API

### 🔧 Development Setup
- **[Build from Source](./getting-started-development.md)** - For contributors and testers

### ⚡ Advanced Features (Optional)
- **[Collaborative Editing with Yjs](./getting-started-collaboration.md)** - Real-time multi-user editing
- **[Language Server Protocol (LSP)](./getting-started-lsp.md)** - Autocomplete, diagnostics, and more

## Basic Concepts

All Kerebron implementations follow the same core architecture:

### Core Architecture

- **CoreEditor**: The main editor instance that manages the ProseMirror state
- **Extensions**: Modular plugins that add functionality (marks, nodes, commands, UI)
- **Editor Kits**: Pre-configured bundles of extensions for common use cases

### Editor Lifecycle

1. Create a `CoreEditor` instance with an HTML element and extensions
2. Load content using `loadDocument(mimeType, buffer)`
3. Listen to `transaction` events for updates
4. Save content using `saveDocument(mimeType)`
5. Clean up with `destroy()` when done

### Common Extensions

| Extension | Purpose |
|-----------|---------|
| `ExtensionBasicEditor` | Basic editing features (bold, italic, lists, etc.) |
| `ExtensionMenu` | Toolbar with formatting buttons |
| `ExtensionMarkdown` | Import/export markdown |
| `ExtensionTables` | Table support |
| `ExtensionCodeMirror` | Syntax-highlighted code blocks |
| `ExtensionYjs` | Real-time collaboration |
| `ExtensionLsp` | Language server features |

### Editor Kits (Bundles)

Instead of manually adding extensions, use pre-configured kits:

- **`AdvancedEditorKit`**: Full-featured editor (basic + menu + markdown + tables + code)
- **`YjsEditorKit`**: Adds collaborative editing to any kit
- **`LspEditorKit`**: Adds language server support

## Installation

### Option 1: Install from NPM (Recommended for Production)

Install Kerebron packages using npm, yarn, or pnpm:

```bash
# Core packages (required)
npm install @kerebron/editor @kerebron/extension-basic-editor

# Additional extensions (optional)
npm install @kerebron/extension-menu        # Menu bar with formatting buttons
npm install @kerebron/extension-markdown    # Markdown import/export
npm install @kerebron/extension-tables      # Table support
npm install @kerebron/extension-codemirror  # Code blocks with syntax highlighting

# For collaborative editing (optional)
npm install @kerebron/extension-yjs yjs y-websocket

# For LSP support (optional)
npm install @kerebron/extension-lsp
```

### Option 2: Build from Source (For Development/Testing)

If you're developing or testing Kerebron, you can build it from source.

#### Prerequisites

1. **Install Deno** (required for development):
   ```bash
   # macOS/Linux
   curl -fsSL https://deno.land/install.sh | sh
   
   # Or using npm
   npm install -g deno
   
   # Windows (PowerShell)
   irm https://deno.land/install.ps1 | iex
   ```

2. **Install Rust** (required for WebAssembly modules):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

3. **Add wasm32 target**:
   ```bash
   rustup target add wasm32-unknown-unknown
   ```

#### Clone and Build

```bash
# Clone the repository
git clone https://github.com/mieweb/kerebron.git
cd kerebron

# Build WebAssembly modules (ODT parser, etc.)
deno task build

# Start the development server
deno task -f examples/server-deno-hono start
```

The server will start at `http://localhost:8000` with all examples available.

#### Using Local Build in Your Project

To use your local Kerebron build in your project:

```bash
# In your project directory, link to local packages
npm link ../kerebron/packages/editor
npm link ../kerebron/packages/extension-basic-editor
# ... link other packages as needed
```

Or use npm workspaces/package paths in your `package.json`:

```json
{
  "dependencies": {
    "@kerebron/editor": "file:../kerebron/packages/editor",
    "@kerebron/extension-basic-editor": "file:../kerebron/packages/extension-basic-editor"
  }
}
```

#### Building NPM Packages Locally

To generate npm packages from the Deno source:

```bash
deno -A ./build/build_npm.ts
```

This creates CommonJS + ESM hybrid modules in each package's `npm/` directory.

#### Available Deno Tasks

```bash
deno task build              # Build all WebAssembly extensions
deno task build:ext-wasm     # Build wasm utilities
deno task build:ext-odt      # Build ODT parser WebAssembly
```

### CSS Assets

All implementations need to import CSS files for the extensions you're using:

```css
@import '@kerebron/editor/assets/index.css';
@import '@kerebron/extension-tables/assets/tables.css';
@import '@kerebron/extension-menu/assets/custom-menu.css';
@import '@kerebron/extension-codemirror/assets/codemirror.css';
```

---

## What's Next?

Now that you understand the basics, dive into the detailed guides:

### Implementation Guides
- **[Vanilla JS/TS Guide](./getting-started-vanilla.md)** - Detailed vanilla JavaScript setup
- **[React Guide](./getting-started-react.md)** - React hooks and best practices  
- **[Vue Guide](./getting-started-vue.md)** - Vue 3 Composition and Options API

### Advanced Features
- **[Collaboration Guide](./getting-started-collaboration.md)** - Set up real-time editing with Yjs
- **[LSP Guide](./getting-started-lsp.md)** - Add language server features

### Customization
- **[Custom Menu](../packages/extension-menu/CUSTOM_MENU.md)** - Customize the toolbar
- **[Extension Development](../CONTRIBUTING.md)** - Build your own extensions

### Examples
Browse the `examples/` directory for complete working applications:
- `examples/browser-vanilla-code-editor/` - Pure JavaScript implementation
- `examples/browser-react/` - React with Yjs collaboration
- `examples/browser-vue/` - Vue 3 implementation
- `examples/server-deno-hono/` - Backend server with Yjs and LSP

## Resources

- 🎮 [Kerebron Playground](https://demo.kerebron.com) - Try it live
- 📚 [ProseMirror Documentation](https://prosemirror.net/docs/)
- 🤝 [Yjs Documentation](https://docs.yjs.dev/)
- 💻 [GitHub Repository](https://github.com/mieweb/kerebron)
