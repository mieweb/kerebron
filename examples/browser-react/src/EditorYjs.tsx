// App.tsx or MyEditor.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import * as random from 'lib0/random';
import { userColors } from '@kerebron/extension-yjs/userColors';

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
import '@kerebron/extension-autocomplete/assets/autocomplete.css';
import '@kerebron/extension-yjs/assets/collaboration-status.css';

const MyEditor: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<CoreEditor | null>(null);
  const wsProviderRef = useRef<WebsocketProvider | null>(null);

  const [md, setMd] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<string>(
    'connecting...',
  );

  useEffect(() => {
    if (!editorRef.current) return;

    // Get room ID from URL hash
    const docUrl = globalThis.location.hash.slice(1);
    let roomId: string;
    if (docUrl.startsWith('room:')) {
      roomId = docUrl.substring('room:'.length);
    } else {
      roomId = String(Math.random()).substring(2, 12);
      globalThis.location.hash = 'room:' + roomId;
    }

    // Set up Yjs document and WebSocket provider
    const userColor = userColors[random.uint32() % userColors.length];
    const ydoc = new Y.Doc();

    // Connect to the Yjs WebSocket server at localhost:8000
    const wsUrl = 'ws://localhost:8000/yjs';

    const wsProvider = new WebsocketProvider(wsUrl, roomId, ydoc);
    wsProviderRef.current = wsProvider;

    wsProvider.on('status', (event: { status: string }) => {
      console.log('WebSocket status:', event.status);
      setConnectionStatus(event.status);
    });

    // Set user awareness (for showing cursors of other users)
    wsProvider.awareness.setLocalStateField('user', {
      name: 'User ' + Math.floor(Math.random() * 100),
      color: userColor.color,
      colorLight: userColor.light,
    });

    // Initialize the editor with Yjs extension
    const editor = new CoreEditor({
      cdnUrl: 'http://localhost:8000/wasm/',
      uri: 'file:///test.md',
      element: editorRef.current,
      extensions: [
        new ExtensionBasicEditor(),
        new ExtensionCustomMenu(),
        new ExtensionMarkdown(),
        new ExtensionOdt(),
        new ExtensionTables(),
        new ExtensionYjs({ ydoc, provider: wsProvider }),
        new ExtensionDevToolkit(),
        new ExtensionCodeMirror({}),
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

    // Cleanup on unmount
    return () => {
      editor.removeEventListener('transaction', onTransaction);
      wsProvider.disconnect();
      wsProvider.destroy();
      editor.destroy();
    };
  }, []);

  return (
    <div>
      <div
        style={{
          marginBottom: '10px',
          padding: '5px',
          background: connectionStatus === 'connected' ? '#2d5a2d' : '#5a2d2d',
          borderRadius: '4px',
        }}
      >
        <small>
          Collaboration: <strong>{connectionStatus}</strong> | Room:{' '}
          <strong>{globalThis.location.hash.replace('#room:', '')}</strong>{' '}
          | Share this URL to collaborate!
        </small>
      </div>
      <div>
        <div ref={editorRef} className='kb-component' />
      </div>

      <div>
        <div>
          <h5>Markdown Output</h5>
          <pre>{md || "Loading..."}</pre>
        </div>
      </div>
    </div>
  );
};

export default MyEditor;
