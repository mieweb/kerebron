import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import type { CoreEditor } from '../CoreEditor.ts';

export interface EditorContentProps {
  /** The editor instance from useEditor */
  editor: CoreEditor | null;
  /** Additional class name */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

export interface EditorContentRef {
  /** Get the container element */
  getElement: () => HTMLDivElement | null;
}

/**
 * EditorContent renders the Kerebron editor.
 * Use with the useEditor hook.
 *
 * @example
 * ```tsx
 * const editor = useEditor({ extensions: [StarterKit] })
 * return <EditorContent editor={editor} />
 * ```
 */
export const EditorContent = forwardRef<EditorContentRef, EditorContentProps>(
  ({ editor, className = '', style }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      getElement: () => containerRef.current,
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container || !editor) return;

      // Get the editor's DOM element and append it to our container
      const editorDom = editor.view?.dom as HTMLElement | undefined;
      if (editorDom && editorDom.parentElement !== container) {
        container.appendChild(editorDom);
      }

      return () => {
        // Don't remove on cleanup - editor.destroy() handles this
      };
    }, [editor]);

    return (
      <div
        ref={containerRef}
        className={`kb-component ${className}`.trim()}
        style={style}
      />
    );
  },
);

EditorContent.displayName = 'EditorContent';
