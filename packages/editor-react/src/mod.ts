/**
 * React bindings for Kerebron Editor
 *
 * @example
 * ```tsx
 * import { useEditor, EditorContent } from '@kerebron/editor-react'
 * import { StarterKit } from '@kerebron/editor-kits/StarterKit'
 *
 * const MyEditor = () => {
 *   const editor = useEditor({
 *     extensions: [StarterKit],
 *     content: '<p>Hello World!</p>',
 *   })
 *
 *   return <EditorContent editor={editor} />
 * }
 * ```
 *
 * @module
 */

export { useEditor, type UseEditorOptions } from './useEditor.ts';
export {
  EditorContent,
  type EditorContentProps,
  type EditorContentRef,
} from './EditorContent.tsx';

// Re-export CoreEditor for convenience
export { CoreEditor } from '@kerebron/editor';
