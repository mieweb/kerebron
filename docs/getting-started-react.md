# React

This guide describes how to integrate Kerebron with your React project.

## Create a React project (optional)

Start with a fresh React project. [Vite](https://vitejs.dev/guide/) will set up everything we need.

```bash
npm create vite@latest my-kerebron-project -- --template react-ts
cd my-kerebron-project
```

## Install dependencies

```bash
npm install @kerebron/editor @kerebron/editor-react @kerebron/editor-kits
```

## Create an editor component

Create a new component in `src/Kerebron.tsx`:

```tsx
// src/Kerebron.tsx
import { useEditor, EditorContent } from '@kerebron/editor-react'
import { StarterKit } from '@kerebron/editor-kits/StarterKit'

const Kerebron = () => {
  const editor = useEditor({
    extensions: [new StarterKit()],
    content: '<p>Hello World!</p>',
  })

  return <EditorContent editor={editor} />
}

export default Kerebron
```

## Add it to your app

Replace the content of `src/App.tsx` with your new `Kerebron` component:

```tsx
import Kerebron from './Kerebron'

const App = () => {
  return <Kerebron />
}

export default App
```

You should now see a working editor in your browser when you run `npm run dev`.

## Adding Real-time Collaboration

Kerebron supports real-time collaborative editing using [Yjs](https://yjs.dev/). When you add the YJS extension alongside the custom menu, a collaboration status indicator is automatically added to the toolbar.

### Install collaboration dependencies

```bash
npm install @kerebron/extension-yjs @kerebron/extension-menu yjs y-websocket
```

### Create a collaborative editor

```tsx
// src/CollaborativeEditor.tsx
import { useEffect, useRef, useState } from 'react';
import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';
import { ExtensionCustomMenu } from '@kerebron/extension-menu';
import { ExtensionYjs } from '@kerebron/extension-yjs';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

// Import styles
import '@kerebron/editor/assets/index.css';
import '@kerebron/extension-menu/assets/custom-menu.css';
import '@kerebron/extension-yjs/assets/collaboration-status.css';

interface Props {
  roomName: string;
  userName: string;
  websocketUrl?: string;
}

const CollaborativeEditor = ({ 
  roomName, 
  userName, 
  websocketUrl = 'ws://localhost:1234' 
}: Props) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    if (!editorRef.current) return;

    // Create Yjs document
    const ydoc = new Y.Doc();
    
    // Create WebSocket provider
    const provider = new WebsocketProvider(websocketUrl, roomName, ydoc);
    
    // Set user information for awareness
    provider.awareness.setLocalStateField('user', {
      name: userName,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
    });

    // Track connection status
    provider.on('status', ({ status }: { status: string }) => {
      setStatus(status as 'connecting' | 'connected' | 'disconnected');
    });

    // Create editor with collaboration
    const editor = new CoreEditor({
      element: editorRef.current,
      extensions: [
        new AdvancedEditorKit(),
        new ExtensionCustomMenu(), // Auto-adds collaboration status!
        new ExtensionYjs({
          ydoc,
          provider,
          type: ydoc.getXmlFragment('prosemirror'),
        }),
      ],
    });

    return () => {
      editor.destroy();
      provider.destroy();
      ydoc.destroy();
    };
  }, [roomName, userName, websocketUrl]);

  return (
    <div>
      <div>Status: {status}</div>
      <div ref={editorRef} className="kb-component" />
    </div>
  );
};

export default CollaborativeEditor;
```

### Collaboration status features

When using `ExtensionCustomMenu` with `ExtensionYjs`, a collaboration status button automatically appears in the toolbar showing:

- **Connection status**: Green dot (connected) or red dot (disconnected)
- **User count**: Badge showing number of active collaborators
- **User list**: Click to see all collaborators in the room

To disable the automatic collaboration status:

```tsx
new ExtensionCustomMenu({ autoAddCollaborationStatus: false })
```

## Next steps

- [Configure your editor](./configure.md)
- [Add styles to your editor](./style-editor.md)
- [Check the full React example](../examples/browser-react/)
