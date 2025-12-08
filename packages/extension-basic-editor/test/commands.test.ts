import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor/ExtensionBasicEditor';
import { AnyExtension, CoreEditor } from '@kerebron/editor';
import { type JSONContent } from '@kerebron/editor';

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

  const x = editor.can().toggleItalic().run();
  console.log('can toggleItalic', x);

  editor.chain().toggleItalic().run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});
