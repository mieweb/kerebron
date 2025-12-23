import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor/ExtensionBasicEditor';
import { AnyExtension, CoreEditor } from '@kerebron/editor';
import { type JSONContent } from '@kerebron/editor';
import { assertEquals } from '@std/assert';

Deno.test('test command toggleItalic', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'paragraph',
        'content': [
          {
            'type': 'text',
            'text': 'Lorem ipsum',
          },
        ],
      },
    ],
  };

  const extensions: AnyExtension[] = [
    new ExtensionBasicEditor(),
  ];

  const editor = new CoreEditor({
    extensions,
    content,
  });

  editor.chain().selectText(0, 6).run();

  const canToggle = editor.can().toggleItalic().run();
  assertEquals(canToggle, true);

  editor.chain().toggleItalic().run();

  const modified = editor.getJSON();
  assertEquals(modified.content[0].content?.length, 2);

  // Test undoInputRule command
  editor.chain().undoInputRule().run();
});
