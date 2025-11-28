import { type DependencyList, useEffect, useRef, useState } from 'react';
import { CoreEditor } from '@kerebron/editor';
import type { AnyExtensionOrReq, Content } from '@kerebron/editor';

export interface UseEditorOptions {
  /** Array of extensions to use */
  extensions?: AnyExtensionOrReq[];
  /** Initial HTML content */
  content?: string;
  /** Initial JSON content */
  initialContent?: Content;
  /** CDN URL for WASM files */
  cdnUrl?: string;
  /** Document URI */
  uri?: string;
  /** Called when editor is ready */
  onReady?: (editor: CoreEditor) => void;
  /** Called on every transaction */
  onTransaction?: (editor: CoreEditor) => void;
  /** Called when content changes */
  onChange?: (editor: CoreEditor) => void;
  /** Prevent immediate render (useful for SSR) */
  immediatelyRender?: boolean;
}

/**
 * React hook for creating and managing a Kerebron editor instance.
 *
 * @example
 * ```tsx
 * const editor = useEditor({
 *   extensions: [StarterKit],
 *   content: '<p>Hello World!</p>',
 * })
 *
 * return <EditorContent editor={editor} />
 * ```
 */
export function useEditor(
  options: UseEditorOptions = {},
  deps: DependencyList = [],
): CoreEditor | null {
  const [editor, setEditor] = useState<CoreEditor | null>(null);
  const editorContainerRef = useRef<HTMLElement | null>(null);
  const optionsRef = useRef(options);

  // Keep options ref updated
  optionsRef.current = options;

  useEffect(() => {
    // Skip if SSR and immediatelyRender is false
    if (options.immediatelyRender === false && typeof window === 'undefined') {
      return;
    }

    const {
      extensions = [],
      content,
      initialContent,
      cdnUrl,
      uri,
      onReady,
      onTransaction,
      onChange,
    } = optionsRef.current;

    // Create a container element for the editor
    const container = document.createElement('div');
    editorContainerRef.current = container;

    const editorInstance = new CoreEditor({
      element: container,
      extensions,
      content: initialContent,
      cdnUrl,
      uri,
    });

    // Set up event listeners
    if (onTransaction) {
      editorInstance.addEventListener('transaction', () => {
        onTransaction(editorInstance);
      });
    }

    if (onChange) {
      editorInstance.addEventListener('changed', () => {
        onChange(editorInstance);
      });
    }

    // Load HTML content if provided
    if (content) {
      const buffer = new TextEncoder().encode(content);
      editorInstance.loadDocument('text/html', buffer).catch(() => {
        // If HTML loading fails, try setting as plain text
        console.warn('Failed to load HTML content');
      });
    }

    setEditor(editorInstance);

    if (onReady) {
      onReady(editorInstance);
    }

    // Cleanup
    return () => {
      editorInstance.destroy();
      setEditor(null);
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return editor;
}
