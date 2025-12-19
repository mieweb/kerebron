// App.tsx or MyEditor.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import * as random from 'lib0/random';
import { userColors } from '@kerebron/extension-yjs/userColors';

import { CoreEditor } from '@kerebron/editor';
import { ExtensionHistory } from '@kerebron/extension-basic-editor/ExtensionHistory';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';
import { LspEditorKit } from '@kerebron/editor-kits/LspEditorKit';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';
import { LspWebSocketTransport } from '@kerebron/extension-lsp/LspWebSocketTransport';
import { LspTransportGetter, Transport } from '@kerebron/extension-lsp';

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
        case 'yaml':
          return new LspWebSocketTransport(uri + '/yaml');
      }
      return undefined;
    };

    // Initialize the editor
    const editor = new CoreEditor({
      element: editorRef.current,
      extensions: [
        new AdvancedEditorKit(),
        new ExtensionHistory(),
        LspEditorKit.createFrom({ getLspTransport }),
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
