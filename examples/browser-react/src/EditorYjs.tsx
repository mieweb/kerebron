// App.tsx or MyEditor.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import * as random from 'lib0/random';
import { userColors } from '@kerebron/extension-yjs/userColors';

import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';

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

    // Get room ID from URL hash
    const hash = window.location.hash.slice(1);
    const roomId = hash.startsWith('room:')
      ? hash.substring('room:'.length)
      : String(Math.random());

    // Initialize Yjs document and WebSocket provider
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(
      'wss://localhost:8000/yjs',
      roomId,
      doc,
      {
        connect: true,
      },
    );

    setYdoc(doc);
    wsProvider.current = provider;

    const userColor = userColors[random.uint32() % userColors.length];

    // Initialize the editor
    const editor = new CoreEditor({
      element: editorRef.current,
      extensions: [
        new AdvancedEditorKit(),
        YjsEditorKit.createFrom(doc, roomId, userColor),
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
      provider.destroy();
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
      </div>
    </div>
  );
};

export default MyEditor;
