import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import { CoreEditor, JSONContent } from '@kerebron/editor';
import { assertEquals } from '@std/assert';

Deno.test('MarkItalic should handle commands', () => {
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

  const editor = new CoreEditor({
    extensions: [new ExtensionBasicEditor()],
    content
  });

  editor.chain().selectText(2, 4).run();

  editor.chain().toggleItalic().run();
  {
    const modified = editor.getJSON();
    assertEquals(modified.content[0].content?.length, 3);
    assertEquals(modified.content[0].content[1].marks, [
      {
        type: 'em',
      },
    ]);
  }

  editor.chain().toggleItalic().run();
  {
    const modified = editor.getJSON();
    assertEquals(modified.content[0].content?.length, 1);
  }

});
