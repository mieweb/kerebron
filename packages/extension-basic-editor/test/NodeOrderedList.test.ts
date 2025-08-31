import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import { CoreEditor, JSONContent } from '@kerebron/editor';
import { assertEquals } from '@std/assert';

Deno.test('NodeOrderedList should handle commands', () => {
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
      {
        'type': 'paragraph',
        'content': [
          {
            'type': 'br',
          },
          {
            'type': 'text',
            'text': 'dolor sit amet',
          },
        ],
      },
    ],
  };

  const editor = new CoreEditor({
    extensions: [new ExtensionBasicEditor()],
    content,
  });

  editor.chain().selectText(2, 20).run();

  editor.chain().toggleOrderedList().run();
  {
    const modified = editor.getJSON();
    console.log(JSON.stringify(modified.content[0].content, null, 2));

    // assertEquals(modified.content[0].content?.length, 3);
    // assertEquals(modified.content[0].content[1].marks, [
    //   {
    //     type: 'underline',
    //   },
    // ]);
  }

  editor.chain().selectAll().run();

  editor.chain().toggleOrderedList().run();
  {
    const modified = editor.getJSON();
    console.log(JSON.stringify(modified.content, null, 2));
  }
});
