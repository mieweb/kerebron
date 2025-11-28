# Server Deno Hono Example

A Deno server using Hono framework for serving the Kerebron editor with optional LSP (Language Server Protocol) support.

## Running the Server

Start the development server:

```bash
deno task start
```

### Command-Line Options

#### `--without-lsp`

Disable LSP endpoints. By default, LSP is enabled.

```bash
# Run without LSP support
deno task start --without-lsp

# Run with LSP support (default)
deno task start
```

## Features

- Serves static files and examples
- YJS collaborative editing support via WebSocket
- Optional LSP WebSocket endpoints for various language servers (TypeScript, YAML, Deno, etc.)
- Development proxy for hot module reloading
