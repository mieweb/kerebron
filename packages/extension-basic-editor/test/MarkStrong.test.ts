import { CoreEditor, JSONContent } from '@kerebron/editor';
import { ExtensionBasicEditor } from '../src/ExtensionBasicEditor.ts';
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
    content,
  });

  editor.chain().selectText(2, 4).run();

  editor.chain().toggleStrong().run();

  {
    const modified = editor.getJSON();
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
    content,
  });

  editor.chain().selectText(2, 4).run();

  editor.chain().toggleStrong().run();
  editor.chain().toggleItalic().run();

  {
    const modified = editor.getJSON();

    assertEquals(modified.content[0].content?.length, 3);
    assertEquals(modified.content[0].content[1].marks, [
      {
        type: 'em',
      },
      {
        type: 'strong',
      },
    ]);
  }

  editor.chain().toggleStrong().run();

  {
    const modified = editor.getJSON();

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

    assertEquals(modified.content[0].content?.length, 5);
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
    assertEquals(modified.content[0].content[3].marks, [
      {
        type: 'strong',
      },
    ]);
  }
});
