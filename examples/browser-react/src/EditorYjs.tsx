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
import {
  ExtensionLsp,
  type LspTransportGetter,
  type Transport,
} from '@kerebron/extension-lsp';
import { LspWebSocketTransport } from '@kerebron/extension-lsp/LspWebSocketTransport';

import '@kerebron/editor/assets/index.css';
import '@kerebron/extension-tables/assets/tables.css';
import '@kerebron/extension-menu/assets/custom-menu.css';
import '@kerebron/extension-codemirror/assets/codemirror.css';
import '@kerebron/extension-autocomplete/assets/autocomplete.css';
import '@kerebron/extension-yjs/assets/collaboration-status.css';
import '@kerebron/extension-lsp/assets/lsp-status.css';

interface EditorYjsProps {
  roomId: string;
  userName: string;
  isLightMode?: boolean;
}

const MyEditor: React.FC<EditorYjsProps> = (
  { roomId, userName, isLightMode },
) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<CoreEditor | null>(null);
  const wsProviderRef = useRef<WebsocketProvider | null>(null);

  const [md, setMd] = useState<string>('');

  useEffect(() => {
    if (!editorRef.current) return;

    // Set up Yjs document and WebSocket provider
    const userColor = userColors[random.uint32() % userColors.length];
    const ydoc = new Y.Doc();

    // Connect to the Yjs WebSocket server at localhost:8000
    const wsUrl = 'ws://localhost:8000/yjs';

    const wsProvider = new WebsocketProvider(wsUrl, roomId, ydoc);
    wsProviderRef.current = wsProvider;

    // Set user awareness (for showing cursors of other users)
    wsProvider.awareness.setLocalStateField('user', {
      name: userName,
      color: userColor.color,
      colorLight: userColor.light,
    });

    // LSP transport getter for markdown language server
    const getLspTransport: LspTransportGetter = (
      lang: string,
    ): Transport | undefined => {
      const protocol = globalThis.location.protocol === 'http:'
        ? 'ws:'
        : 'wss:';
      const uri = protocol + '//' + globalThis.location.host + '/lsp';

      switch (lang) {
        case 'markdown':
          return new LspWebSocketTransport(uri + '/mine');
        case 'json':
          return new LspWebSocketTransport(uri + '/deno');
        case 'typescript':
        case 'javascript':
          return new LspWebSocketTransport(uri + '/typescript');
      }
      return undefined;
    };

    // Initialize the editor with Yjs extension
    const editor = new CoreEditor({
      cdnUrl: 'http://localhost:8000/wasm/',
      uri: 'file:///test.md',
      element: editorRef.current,
      extensions: [
        new ExtensionBasicEditor(),
        new ExtensionMarkdown(),
        new ExtensionOdt(),
        new ExtensionTables(),
        new ExtensionYjs({ ydoc, provider: wsProvider }),
        new ExtensionLsp({ getLspTransport }),
        new ExtensionCustomMenu(), // Must come after YJS and LSP for auto-detection
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
  }, [roomId, userName]);

  // Update user name in awareness when it changes
  useEffect(() => {
    if (wsProviderRef.current) {
      const currentState = wsProviderRef.current.awareness.getLocalState();
      if (currentState?.user) {
        wsProviderRef.current.awareness.setLocalStateField('user', {
          ...currentState.user,
          name: userName,
        });
      }
    }
  }, [userName]);

  return (
    <div>
      <div>
        <div
          ref={editorRef}
          className={`kb-component ${
            isLightMode ? 'kb-component--light' : 'kb-component--dark'
          }`}
        />
      </div>

      <div>
        <div>
          <h5>Markdown Output</h5>
          <pre>{md || 'Loading...'}</pre>
        </div>
      </div>
    </div>
  );
};

export default MyEditor;
