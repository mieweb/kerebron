# Getting Started with React

This guide shows you how to integrate Kerebron into a React application using hooks and functional components.

## Installation

```bash
npm install @kerebron/editor @kerebron/extension-basic-editor @kerebron/extension-menu @kerebron/extension-markdown @kerebron/editor-kits
```

### Optional Extensions

```bash
npm install @kerebron/extension-tables      # Table support
npm install @kerebron/extension-codemirror  # Code blocks with syntax highlighting
```

## Basic Component

Create a simple editor component:

```tsx
// components/Editor.tsx
import React, { useEffect, useRef, useState } from 'react';
import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';

// Import CSS
import '@kerebron/editor/assets/index.css';
import '@kerebron/extension-menu/assets/custom-menu.css';
import '@kerebron/extension-tables/assets/tables.css';

const Editor: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<CoreEditor | null>(null);
  const [markdown, setMarkdown] = useState<string>('');

  useEffect(() => {
    if (!editorRef.current) return;

    // Initialize editor
    const editor = new CoreEditor({
      element: editorRef.current,
      extensions: [new AdvancedEditorKit()],
    });

    editorInstance.current = editor;

    // Listen for changes
    const onTransaction = async () => {
      const buffer = await editor.saveDocument('text/x-markdown');
      const md = new TextDecoder().decode(buffer);
      setMarkdown(md);
    };

    editor.addEventListener('transaction', onTransaction);

    // Load initial content
    const loadInitialContent = async () => {
      const content = '# Welcome\n\nStart editing here...';
      const buffer = new TextEncoder().encode(content);
      await editor.loadDocument('text/x-markdown', buffer);
    };
    loadInitialContent();

    // Cleanup
    return () => {
      editor.removeEventListener('transaction', onTransaction);
      editor.destroy();
    };
  }, []);

  return (
    <div>
      <div ref={editorRef} className="kb-component" />
      
      {/* Optional: Show markdown preview */}
      <div style={{ marginTop: '20px' }}>
        <h3>Markdown Output</h3>
        <pre style={{ background: '#f5f5f5', padding: '10px' }}>
          {markdown}
        </pre>
      </div>
    </div>
  );
};

export default Editor;
```

## Advanced Component with Props

Create a reusable editor component that accepts props:

```tsx
// components/KerebronEditor.tsx
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';

import '@kerebron/editor/assets/index.css';
import '@kerebron/extension-menu/assets/custom-menu.css';
import '@kerebron/extension-tables/assets/tables.css';

interface KerebronEditorProps {
  initialContent?: string;
  onChange?: (markdown: string) => void;
  onReady?: (editor: CoreEditor) => void;
}

export interface KerebronEditorRef {
  getMarkdown: () => Promise<string>;
  loadMarkdown: (content: string) => Promise<void>;
  loadFile: (file: File) => Promise<void>;
}

const KerebronEditor = forwardRef<KerebronEditorRef, KerebronEditorProps>(
  ({ initialContent, onChange, onReady }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const editorInstance = useRef<CoreEditor | null>(null);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getMarkdown: async () => {
        if (!editorInstance.current) return '';
        const buffer = await editorInstance.current.saveDocument('text/x-markdown');
        return new TextDecoder().decode(buffer);
      },
      loadMarkdown: async (content: string) => {
        if (!editorInstance.current) return;
        const buffer = new TextEncoder().encode(content);
        await editorInstance.current.loadDocument('text/x-markdown', buffer);
      },
      loadFile: async (file: File) => {
        if (!editorInstance.current) return;
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        await editorInstance.current.loadDocument(
          file.type || 'application/octet-stream',
          uint8Array
        );
      },
    }));

    useEffect(() => {
      if (!editorRef.current) return;

      const editor = new CoreEditor({
        element: editorRef.current,
        extensions: [new AdvancedEditorKit()],
      });

      editorInstance.current = editor;

      // Handle transactions
      const onTransaction = async () => {
        if (!onChange) return;
        const buffer = await editor.saveDocument('text/x-markdown');
        const md = new TextDecoder().decode(buffer);
        onChange(md);
      };

      editor.addEventListener('transaction', onTransaction);

      // Load initial content
      if (initialContent) {
        const buffer = new TextEncoder().encode(initialContent);
        editor.loadDocument('text/x-markdown', buffer);
      }

      // Notify parent
      if (onReady) {
        onReady(editor);
      }

      return () => {
        editor.removeEventListener('transaction', onTransaction);
        editor.destroy();
      };
    }, []);

    return <div ref={editorRef} className="kb-component" />;
  }
);

KerebronEditor.displayName = 'KerebronEditor';

export default KerebronEditor;
```

### Using the Advanced Component

```tsx
// App.tsx
import React, { useRef, useState } from 'react';
import KerebronEditor, { KerebronEditorRef } from './components/KerebronEditor';

function App() {
  const editorRef = useRef<KerebronEditorRef>(null);
  const [markdown, setMarkdown] = useState('');

  const handleLoadSample = async () => {
    await editorRef.current?.loadMarkdown('# Sample\n\nThis is a **sample** document.');
  };

  const handleLoadFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.odt,.docx';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        await editorRef.current?.loadFile(file);
      }
    };
    input.click();
  };

  const handleSave = async () => {
    const md = await editorRef.current?.getMarkdown();
    if (md) {
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.md';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      <h1>Kerebron Editor - React</h1>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button onClick={handleLoadSample}>Load Sample</button>
        <button onClick={handleLoadFile}>Load File</button>
        <button onClick={handleSave}>Save Markdown</button>
      </div>

      <KerebronEditor
        ref={editorRef}
        initialContent="# Hello World\n\nStart editing!"
        onChange={setMarkdown}
      />

      <div style={{ marginTop: '20px' }}>
        <h3>Live Preview</h3>
        <pre style={{ background: '#f5f5f5', padding: '10px' }}>
          {markdown}
        </pre>
      </div>
    </div>
  );
}

export default App;
```

## Custom Hook

Create a reusable hook for common editor operations:

```tsx
// hooks/useKerebron.ts
import { useEffect, useRef, useState } from 'react';
import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';

export function useKerebron(initialContent?: string) {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<CoreEditor | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!editorRef.current) return;

    const editor = new CoreEditor({
      element: editorRef.current,
      extensions: [new AdvancedEditorKit()],
    });

    editorInstance.current = editor;

    const onTransaction = async () => {
      const buffer = await editor.saveDocument('text/x-markdown');
      const md = new TextDecoder().decode(buffer);
      setMarkdown(md);
    };

    editor.addEventListener('transaction', onTransaction);

    if (initialContent) {
      const buffer = new TextEncoder().encode(initialContent);
      editor.loadDocument('text/x-markdown', buffer).then(() => {
        setIsReady(true);
      });
    } else {
      setIsReady(true);
    }

    return () => {
      editor.removeEventListener('transaction', onTransaction);
      editor.destroy();
    };
  }, []);

  const loadMarkdown = async (content: string) => {
    if (!editorInstance.current) return;
    const buffer = new TextEncoder().encode(content);
    await editorInstance.current.loadDocument('text/x-markdown', buffer);
  };

  const getEditor = () => editorInstance.current;

  return {
    editorRef,
    markdown,
    isReady,
    loadMarkdown,
    getEditor,
  };
}
```

### Using the Custom Hook

```tsx
// components/SimpleEditor.tsx
import React from 'react';
import { useKerebron } from '../hooks/useKerebron';
import '@kerebron/editor/assets/index.css';
import '@kerebron/extension-menu/assets/custom-menu.css';

function SimpleEditor() {
  const { editorRef, markdown, isReady, loadMarkdown } = useKerebron('# Initial Content');

  return (
    <div>
      <button 
        onClick={() => loadMarkdown('# New Content\n\nReplaced!')}
        disabled={!isReady}
      >
        Replace Content
      </button>
      
      <div ref={editorRef} className="kb-component" />
      
      <pre>{markdown}</pre>
    </div>
  );
}

export default SimpleEditor;
```

## With Vite

If you're using Vite, your `vite.config.ts` should look like:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: [
      '@kerebron/editor',
      '@kerebron/extension-basic-editor',
      '@kerebron/extension-menu',
    ],
  },
});
```

## TypeScript Types

For better TypeScript support, you can create type definitions:

```typescript
// types/kerebron.d.ts
declare module '@kerebron/editor' {
  export class CoreEditor {
    constructor(config: {
      element: HTMLElement;
      extensions: any[];
      uri?: string;
      cdnUrl?: string;
    });
    loadDocument(mimeType: string, buffer: Uint8Array): Promise<void>;
    saveDocument(mimeType: string): Promise<Uint8Array>;
    addEventListener(event: string, callback: (e: any) => void): void;
    removeEventListener(event: string, callback: (e: any) => void): void;
    destroy(): void;
  }
}
```

## Next Steps

- **[Add Collaboration](./getting-started-collaboration.md)** - Enable real-time multi-user editing
- **[Add LSP Support](./getting-started-lsp.md)** - Get autocomplete and diagnostics
- **[Customize Menu](../packages/extension-menu/CUSTOM_MENU.md)** - Build a custom toolbar
- **[Check Examples](../examples/browser-react/)** - See a complete React implementation

## Troubleshooting

### Editor Not Rendering

- Ensure CSS is imported at the component level or in your main app
- Check that the ref element exists when the editor initializes
- Verify extensions are installed

### Re-renders Causing Issues

- Use `useRef` for the editor instance, not `useState`
- Avoid recreating the editor on every render
- Clean up properly in the `useEffect` return function

### TypeScript Errors

- Add type definitions for Kerebron packages
- Install `@types/react` and ensure it's up to date
- Check that your `tsconfig.json` has proper module resolution
