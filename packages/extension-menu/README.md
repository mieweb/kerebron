# Menu extension

Custom menu system for ProseMirror editors with pinnable tools and overflow management.

## Features

- **Pinnable Tools**: Pin/unpin tools to customize the toolbar
- **Overflow Menu**: Tools that don't fit in the toolbar appear in an overflow menu
- **Mobile Responsive**: Automatically limits toolbar to 4 tools on narrow screens (< 768px)
- **State Persistence**: Pinned tool configuration saved to localStorage
- **Trailing Elements**: Support for fixed elements on the right side of the toolbar (e.g., status indicators)
- **Auto YJS Integration**: Automatically adds collaboration status when YJS extension is detected
- **Auto LSP Integration**: Automatically adds LSP status when LSP extension is detected

## Usage

```typescript
import { ExtensionCustomMenu } from '@kerebron/extension-menu';

// Basic usage - auto-detects YJS and LSP, adds status indicators
new Editor({
  extensions: [
    // ... other extensions
    ExtensionYjs({ ydoc, provider }),  // Optional: for collaboration
    ExtensionLsp({ getLspTransport }), // Optional: for LSP support
    ExtensionCustomMenu(),             // Must come LAST for auto-detection
  ],
});

// Disable auto status indicators
new Editor({
  extensions: [
    ExtensionCustomMenu({ 
      autoAddCollaborationStatus: false,
      autoAddLspStatus: false,
    }),
    // ... other extensions
  ],
});

// Custom trailing elements
import { CollaborationStatusElement } from '@kerebron/extension-yjs/CollaborationStatus';
import { LspStatusElement } from '@kerebron/extension-lsp/LspStatus';

new Editor({
  extensions: [
    ExtensionCustomMenu({
      autoAddCollaborationStatus: false,
      autoAddLspStatus: false,
      trailingElements: [
        new CollaborationStatusElement({ awareness, provider }),
        new LspStatusElement({ lspExtension, label: 'LSP' }),
      ],
    }),
    // ... other extensions
  ],
});
```

## Extension Order

**Important**: For auto-detection to work, `ExtensionCustomMenu` must be registered **after** any extensions you want it to detect:

```typescript
extensions: [
  // ... other extensions
  new ExtensionYjs({ ... }),    // Register first (if using)
  new ExtensionLsp({ ... }),    // Register second (if using)
  new ExtensionCustomMenu(),    // Register LAST for auto-detection
]
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `content` | `MenuElement[][]` | Auto-generated | Custom menu content (pinnable tools) |
| `trailingElements` | `MenuElement[]` | `[]` | Fixed elements on the right side of toolbar |
| `autoAddCollaborationStatus` | `boolean` | `true` | Auto-add collaboration status when YJS is detected |
| `autoAddLspStatus` | `boolean` | `true` | Auto-add LSP status when LSP extension is detected |

## CSS Imports

Don't forget to import the necessary CSS files:

```typescript
import '@kerebron/extension-menu/assets/custom-menu.css';
import '@kerebron/extension-yjs/assets/collaboration-status.css';  // If using YJS
import '@kerebron/extension-lsp/assets/lsp-status.css';            // If using LSP
```

## Debug Mode

Debug logging is disabled by default. To enable detailed logging for troubleshooting:

```javascript
// Enable debug mode
localStorage.setItem('kb-custom-menu-debug', 'true');

// Disable debug mode
localStorage.removeItem('kb-custom-menu-debug');
```

After changing the debug flag, refresh the page to see debug output in the console.

## Development

The custom menu plugin provides a configurable toolbar that adapts to available space and user preferences, with persistent state across sessions.
