# YJS Extension

Real-time collaborative editing extension for ProseMirror using [Yjs](https://yjs.dev/).

## Features

- **Real-time Collaboration**: Multiple users can edit the same document simultaneously
- **Awareness Protocol**: See other users' cursors and selections
- **Collaboration Status UI**: Built-in toolbar element showing connection status and active collaborators
- **User Colors**: Automatic color assignment for collaborators

## Installation

```typescript
import { ExtensionYjs } from '@kerebron/extension-yjs';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
```

## Usage

### Basic Setup

```typescript
import { Editor } from '@kerebron/editor';
import { ExtensionYjs } from '@kerebron/extension-yjs';
import { ExtensionCustomMenu } from '@kerebron/extension-menu';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

// Create Yjs document and provider
const ydoc = new Y.Doc();
const provider = new WebsocketProvider('ws://localhost:1234', 'my-room', ydoc);

// Set user info for awareness
provider.awareness.setLocalStateField('user', {
  name: 'User Name',
  color: '#ff0000',
});

// Create editor with YJS support
const editor = new Editor({
  extensions: [
    ExtensionCustomMenu(), // Automatically shows collaboration status
    ExtensionYjs({
      ydoc,
      provider,
      type: ydoc.getXmlFragment('prosemirror'),
    }),
  ],
});
```

### Collaboration Status

When using `ExtensionCustomMenu` with `ExtensionYjs`, a collaboration status button is automatically added to the toolbar. This shows:

- **Connection Status**: Green dot (connected) or red dot (disconnected)
- **User Count**: Number of active collaborators
- **User List**: Dropdown showing all collaborators with their names

#### Automatic Integration

The collaboration status is added automatically when both extensions are present:

```typescript
new Editor({
  extensions: [
    ExtensionCustomMenu(), // Auto-detects YJS
    ExtensionYjs({ ydoc, provider, type }),
  ],
});
```

#### Manual Integration

If you need more control, you can manually add the collaboration status:

```typescript
import { CollaborationStatusElement } from '@kerebron/extension-yjs/CollaborationStatus';
import '@kerebron/extension-yjs/assets/collaboration-status.css';

const collabStatus = new CollaborationStatusElement({
  awareness: provider.awareness,
  provider: provider,
});

new Editor({
  extensions: [
    ExtensionCustomMenu({
      autoAddCollaborationStatus: false,
      trailingElements: [collabStatus],
    }),
    ExtensionYjs({ ydoc, provider, type }),
  ],
});
```

#### Disable Collaboration Status

To disable the automatic collaboration status:

```typescript
new Editor({
  extensions: [
    ExtensionCustomMenu({ autoAddCollaborationStatus: false }),
    ExtensionYjs({ ydoc, provider, type }),
  ],
});
```

## Exports

| Export | Description |
|--------|-------------|
| `@kerebron/extension-yjs` | Main extension class |
| `@kerebron/extension-yjs/userColors` | User color utilities |
| `@kerebron/extension-yjs/CollaborationStatus` | Collaboration status UI element |
| `@kerebron/extension-yjs/assets/collaboration-status.css` | Styles for collaboration status |

## CollaborationStatusElement Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `awareness` | `Awareness` | Yes | Yjs awareness instance |
| `provider` | `WebsocketProvider` | Yes | WebSocket provider for connection status |

## Styling

The collaboration status element supports both light and dark themes via CSS custom properties. Import the styles:

```typescript
import '@kerebron/extension-yjs/assets/collaboration-status.css';
```

Or include via HTML:

```html
<link rel="stylesheet" href="@kerebron/extension-yjs/assets/collaboration-status.css">
```

### CSS Classes

| Class | Description |
|-------|-------------|
| `.kb-collab-status` | Main container |
| `.kb-collab-status__trigger` | Button that shows status and count |
| `.kb-collab-status__dot` | Connection status indicator |
| `.kb-collab-status__dot--connected` | Green dot for connected state |
| `.kb-collab-status__dot--disconnected` | Red dot for disconnected state |
| `.kb-collab-status__count` | User count badge |
| `.kb-collab-status__dropdown` | User list dropdown |
| `.kb-collab-status__user` | Individual user item |
| `.kb-collab-status__user--self` | Current user indicator |

## Related

- [ExtensionCustomMenu](../extension-menu/README.md) - Toolbar with auto YJS integration
- [Yjs Documentation](https://docs.yjs.dev/)
- [y-websocket](https://github.com/yjs/y-websocket)
