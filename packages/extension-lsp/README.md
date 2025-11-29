# LSP Extension

Language Server Protocol (LSP) integration for Kerebron editors.

## Features

- **LSP Client**: Connect to any LSP-compatible language server
- **WebSocket Transport**: Built-in WebSocket transport for browser-based connections
- **Autocomplete**: Get intelligent code completions from the language server
- **Diagnostics**: Display errors and warnings from the language server
- **Status Indicator**: Visual indicator showing LSP connection status in the toolbar

## Installation

```bash
npm install @kerebron/extension-lsp
```

## Usage

### Basic Setup

```typescript
import { CoreEditor } from '@kerebron/editor';
import { ExtensionLsp, type LspTransportGetter, type Transport } from '@kerebron/extension-lsp';
import { LspWebSocketTransport } from '@kerebron/extension-lsp/LspWebSocketTransport';

// Import styles for the status indicator
import '@kerebron/extension-lsp/assets/lsp-status.css';

// Configure transport for different languages
const getLspTransport: LspTransportGetter = (lang: string): Transport | undefined => {
  const baseUrl = 'ws://localhost:8000/lsp';
  
  switch (lang) {
    case 'markdown':
      return new LspWebSocketTransport(`${baseUrl}/markdown`);
    case 'typescript':
    case 'javascript':
      return new LspWebSocketTransport(`${baseUrl}/typescript`);
    case 'json':
      return new LspWebSocketTransport(`${baseUrl}/json`);
    default:
      return undefined;
  }
};

const editor = new CoreEditor({
  element: document.getElementById('editor'),
  uri: 'file:///document.md',  // Required: LSP needs a file URI
  extensions: [
    // ... other extensions
    new ExtensionLsp({ getLspTransport }),
  ],
});
```

### With Toolbar Status Indicator

When used with `ExtensionCustomMenu`, an LSP status indicator is automatically added to the toolbar:

```typescript
import { ExtensionCustomMenu } from '@kerebron/extension-menu';
import { ExtensionLsp } from '@kerebron/extension-lsp';

import '@kerebron/extension-menu/assets/custom-menu.css';
import '@kerebron/extension-lsp/assets/lsp-status.css';

const editor = new CoreEditor({
  element: document.getElementById('editor'),
  uri: 'file:///document.md',
  extensions: [
    // ... other extensions
    new ExtensionLsp({ getLspTransport }),
    new ExtensionCustomMenu(),  // Must come AFTER ExtensionLsp
  ],
});
```

The status indicator shows:

| Status | Indicator | Description |
|--------|-----------|-------------|
| Connected | 🟢 Green dot | Successfully connected to LSP server |
| Connecting | 🟡 Yellow pulsing dot | Attempting to connect |
| Disconnected | 🔴 Red dot | Not connected to LSP server |

### Disable Auto Status Indicator

```typescript
new ExtensionCustomMenu({ autoAddLspStatus: false })
```

### Manual Status Element

You can manually add the LSP status element for more control:

```typescript
import { LspStatusElement } from '@kerebron/extension-lsp/LspStatus';

const lspExtension = new ExtensionLsp({ getLspTransport });

new ExtensionCustomMenu({
  autoAddLspStatus: false,
  trailingElements: [
    new LspStatusElement({
      lspExtension,
      label: 'Language Server',  // Custom label (default: 'LSP')
    }),
  ],
});
```

## Configuration

### LspConfig

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `getLspTransport` | `LspTransportGetter` | Yes | Function that returns a transport for a given language |

### LspTransportGetter

```typescript
type LspTransportGetter = (lang: string) => Transport | undefined;
```

Returns a `Transport` instance for the specified language, or `undefined` if no LSP support is available for that language.

## Transports

### LspWebSocketTransport

Built-in WebSocket transport for browser-based LSP connections:

```typescript
import { LspWebSocketTransport } from '@kerebron/extension-lsp/LspWebSocketTransport';

const transport = new LspWebSocketTransport('ws://localhost:8000/lsp/typescript');
```

### Custom Transport

Implement the `Transport` interface for custom transport mechanisms:

```typescript
interface Transport {
  connect(): Promise<void>;
  disconnect(): void;
  send(message: string): void;
  onMessage(handler: (message: string) => void): void;
  onError(handler: (error: Error) => void): void;
  onClose(handler: () => void): void;
}
```

## Server Setup

The LSP extension requires a server that proxies WebSocket connections to LSP servers. See the `server-deno-hono` example for a reference implementation.

Example server routes:

```typescript
// Proxy to a markdown language server
app.get('/lsp/markdown', upgradeWebSocket(() => {
  return lspAdapter.upgradeWebSocket();
}));

// Proxy to TypeScript language server
app.get('/lsp/typescript', upgradeWebSocket(() => {
  return proxyProcess('npx', ['typescript-language-server', '--stdio']);
}));
```

## CSS Classes

The status indicator uses the following CSS classes for customization:

| Class | Description |
|-------|-------------|
| `.kb-lsp-status` | Container element |
| `.kb-lsp-status__button` | Button wrapper |
| `.kb-lsp-status__dot` | Status dot indicator |
| `.kb-lsp-status__dot--connected` | Green connected state |
| `.kb-lsp-status__dot--connecting` | Yellow connecting state (pulsing) |
| `.kb-lsp-status__dot--disconnected` | Red disconnected state |
| `.kb-lsp-status__label` | Text label |

## Related

- [@kerebron/extension-menu](../extension-menu) - Custom menu with auto LSP status detection
- [@kerebron/extension-autocomplete](../extension-autocomplete) - Autocomplete functionality
