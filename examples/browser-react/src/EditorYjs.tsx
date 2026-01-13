// App.tsx or MyEditor.tsx
import React, { useEffect, useRef, useState } from 'react';

import { CoreEditor } from '@kerebron/editor';
import { ExtensionHistory } from '@kerebron/extension-basic-editor/ExtensionHistory';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';
import { LspEditorKit } from '@kerebron/editor-kits/LspEditorKit';
import { LspWebSocketTransport } from '@kerebron/extension-lsp/LspWebSocketTransport';
import { LspTransportGetter, Transport } from '@kerebron/extension-lsp';

const MyEditor: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<CoreEditor | null>(null);

  const [md, setMd] = useState<string>('');

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
    const editor = CoreEditor.create({
      element: editorRef.current,
      uri: 'file:///untitled.md',
      editorKits: [
        new AdvancedEditorKit(),
        LspEditorKit.createFrom({ getLspTransport }),
        {
          getExtensions() {
            return [new ExtensionHistory()];
          },
        },
      ],
    });

    editorInstance.current = editor;

    // Expose editor to window for testing
    (window as unknown as { editor: CoreEditor }).editor = editor;

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
