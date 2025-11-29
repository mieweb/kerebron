# Menu extension

Custom menu system for ProseMirror editors with pinnable tools and overflow management.

## Features

- **Pinnable Tools**: Pin/unpin tools to customize the toolbar
- **Overflow Menu**: Tools that don't fit in the toolbar appear in an overflow menu
- **Mobile Responsive**: Automatically limits toolbar to 4 tools on narrow screens (< 768px)
- **State Persistence**: Pinned tool configuration saved to localStorage
- **Trailing Elements**: Support for fixed elements on the right side of the toolbar (e.g., collaboration status)
- **Auto YJS Integration**: Automatically adds collaboration status when YJS extension is detected

## Usage

```typescript
import { ExtensionCustomMenu } from '@kerebron/extension-menu';

// Basic usage - auto-detects YJS and adds collaboration status
new Editor({
  extensions: [
    ExtensionCustomMenu(),
    // ... other extensions
  ],
});

// Disable auto collaboration status
new Editor({
  extensions: [
    ExtensionCustomMenu({ autoAddCollaborationStatus: false }),
    // ... other extensions
  ],
});

// Custom trailing elements
import { CollaborationStatusElement } from '@kerebron/extension-yjs/CollaborationStatus';

new Editor({
  extensions: [
    ExtensionCustomMenu({
      autoAddCollaborationStatus: false,
      trailingElements: [
        new CollaborationStatusElement({ awareness, provider }),
        // ... other trailing elements
      ],
    }),
    // ... other extensions
  ],
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `content` | `MenuElement[][]` | Auto-generated | Custom menu content (pinnable tools) |
| `trailingElements` | `MenuElement[]` | `[]` | Fixed elements on the right side of toolbar |
| `autoAddCollaborationStatus` | `boolean` | `true` | Auto-add collaboration status when YJS is detected |

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
