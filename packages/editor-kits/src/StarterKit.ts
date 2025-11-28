import { Extension } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionCustomMenu } from '@kerebron/extension-menu';

/**
 * StarterKit is a collection of commonly used extensions that provide
 * basic functionality like paragraphs, headings, bold, italic, and more.
 *
 * This is the simplest way to get started with Kerebron.
 *
 * @example
 * ```tsx
 * import { useEditor, EditorContent } from '@kerebron/editor/react'
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
 */
export class StarterKit extends Extension {
  override name = 'starter-kit';
  requires = [
    new ExtensionBasicEditor(),
    new ExtensionMarkdown(),
    new ExtensionCustomMenu(),
  ];
}

// Also export as default instance for convenience
export default new StarterKit();
