// App.tsx or MyEditor.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import * as random from 'lib0/random';
import { userColors } from '@kerebron/extension-yjs/userColors';
import { dracula } from 'thememirror';

import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionOdt } from '@kerebron/extension-odt';
import { ExtensionTables } from '@kerebron/extension-tables';
import { ExtensionDevToolkit } from '@kerebron/extension-dev-toolkit';
import { ExtensionCustomMenu } from '@kerebron/extension-menu/ExtensionCustomMenu';
import { ExtensionYjs } from '@kerebron/extension-yjs';
import { ExtensionCodeMirror } from '@kerebron/extension-codemirror';

import '@kerebron/editor/assets/index.css';
import '@kerebron/extension-tables/assets/tables.css';
import '@kerebron/extension-menu/assets/custom-menu.css';
import '@kerebron/extension-codemirror/assets/codemirror.css';

const MyEditor: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<CoreEditor | null>(null);
  const wsProvider = useRef<WebsocketProvider | null>(null);

  const [md, setMd] = useState<string>('');
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);

  // Public methods (equivalent to expose in Vue)
  const loadDoc = async () => {
    if (!editorInstance.current) return;

    const content = `# TEST

1. aaa **bold**
2. bbb

\`\`\`js
console.log("TEST")
\`\`\`
`;

    const buffer = new TextEncoder().encode(content);
    await editorInstance.current.loadDocument('text/x-markdown', buffer);
  };

  const loadDoc2 = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.odt,.docx';

    input.onchange = async (e: any) => {
      const file: File = e.target.files[0];
      if (!file || !editorInstance.current) return;

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      await editorInstance.current.loadDocument(
        file.type || 'application/octet-stream',
        uint8Array,
      );
    };

    input.click();
  };

  useEffect(() => {
    if (!editorRef.current) return;

    // Extract room from URL hash: #room:abc123
    let hash = window.location.hash.slice(1);
    let roomId: string;

    if (hash.startsWith('room:')) {
      roomId = hash.substring('room:'.length);
    } else {
      roomId = Math.random().toString(36).substring(2, 9);
      window.location.hash = 'room:' + roomId;
    }

    const userColor = userColors[random.uint32() % userColors.length];

    const ydoc = new Y.Doc();
    setYdoc(ydoc);

    const protocol = window.location.protocol === 'http:' ? 'ws:' : 'wss:';
    const ws = new WebsocketProvider(
      `${protocol}//${window.location.host}/yjs`,
      roomId,
      ydoc,
    );

    ws.on('status', (event: { status: 'connected' | 'disconnected' }) => {
      console.log('WebSocket status:', event.status);
    });

    ws.awareness.setLocalStateField('user', {
      name: 'Anonymous ' + Math.floor(Math.random() * 100),
      color: userColor.color,
      colorLight: userColor.light,
    });

    wsProvider.current = ws;

    // Initialize the editor
    const editor = new CoreEditor({
      element: editorRef.current,
      extensions: [
        new ExtensionBasicEditor(),
        new ExtensionCustomMenu(),
        new ExtensionMarkdown(),
        new ExtensionOdt(),
        new ExtensionTables(),
        new ExtensionYjs({ ydoc, provider: ws }),
        new ExtensionDevToolkit(),
        new ExtensionCodeMirror({
          theme: [dracula],
        }),
      ],
    });

    editorInstance.current = editor;

    // Listen to transactions and update markdown preview
    const onTransaction = async () => {
      if (!editorInstance.current) return;

      try {
        const buffer = await editorInstance.current.saveDocument(
          'text/x-markdown',
        );
        const markdown = new TextDecoder().decode(buffer);
        setMd(markdown);
      } catch (err) {
        console.error('Failed to save markdown:', err);
      }
    };

    editor.addEventListener('transaction', onTransaction);

    // Optional: Load initial document
    // loadDoc();

    // Cleanup on unmount
    return () => {
      editor.removeEventListener('transaction', onTransaction);
      editor.destroy();
      ws.destroy();
      ydoc.destroy();
    };
  }, []);

  return (
    <div>
      <div>
        <div ref={editorRef} className='kb-component' />
      </div>

      <div>
        <div>
          <h5>Markdown Output</h5>
          <pre>{md || "Loading..."}</pre>
        </div>

        <div>
          <h5>Y.Doc State (JSON)</h5>
          <pre>
            {ydoc ? JSON.stringify(ydoc.toJSON(), null, 2) : "Connecting..."}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default MyEditor;
