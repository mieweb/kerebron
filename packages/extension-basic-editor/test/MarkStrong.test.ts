import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import { CoreEditor, JSONContent } from '@kerebron/editor';
import { assertEquals } from '@std/assert';

Deno.test('MarkStrong should handle commands', () => {
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

  editor.chain().toggleStrong().run();

  {
    const modified = editor.getJSON();
    console.log('modified', modified);

    assertEquals(modified.content[0].content?.length, 3);
    assertEquals(modified.content[0].content[1].marks, [
      {
        type: 'strong',
      },
    ]);
  }

  editor.chain().toggleStrong().run();

  {
    const modified = editor.getJSON();
    console.log('modified2', modified);

    assertEquals(modified.content[0].content?.length, 1);
  }

});

Deno.test('MarkStrong and MarkItalic should handle commands', () => {
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

  editor.chain().toggleStrong().run();
  editor.chain().toggleItalic().run();

  {
    const modified = editor.getJSON();
    console.log('modified', modified);

    assertEquals(modified.content[0].content?.length, 3);
    assertEquals(modified.content[0].content[1].marks, [
      {
        type: 'em'
      },
      {
        type: 'strong',
      },
    ]);
  }

  editor.chain().toggleStrong().run();

  {
    const modified = editor.getJSON();
    console.log('modified2', modified);

    assertEquals(modified.content[0].content?.length, 3);
    assertEquals(modified.content[0].content[1].marks, [
      {
        type: 'em',
      },
    ]);
  }

  editor.chain().selectText(4, 3).run();
  editor.chain().toggleStrong().run();

  {
    const modified = editor.getJSON();
    console.log('modified2', modified);

    assertEquals(modified.content[0].content?.length, 4);
    assertEquals(modified.content[0].content[1].marks, [
      {
        type: 'em',
      },
    ]);
    assertEquals(modified.content[0].content[2].marks, [
      {
        type: 'em',
      },
      {
        type: 'strong',
      },
    ]);
  }

});
