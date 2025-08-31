import { CoreEditor, JSONContent } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionTables } from '@kerebron/extension-tables';
import { NodeCodeMirror } from '@kerebron/extension-codemirror';
import { assertEquals, trimLines } from '@kerebron/test-utils';

Deno.test('Two paragraphs', async () => {
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
            'type': 'text',
            'text': 'dolor sit amet',
          },
        ],
      },
    ],
  };

  const markdown = trimLines`
Lorem ipsum

dolor sit amet
`;

  const markdownExtension = new ExtensionMarkdown();

  const editor = new CoreEditor({
    content,
    extensions: [
      new ExtensionBasicEditor(),
      new ExtensionTables(),
      new NodeCodeMirror(),
      markdownExtension,
    ],
  });

  const output = new TextDecoder().decode(
    await editor.saveDocument('text/x-markdown'),
  );

  const doc = editor.getDocument();

  const converter =
    markdownExtension.getConverters(editor, editor.schema)['text/x-markdown'];
  const converted = new TextDecoder().decode(await converter.fromDoc(doc));

  assertEquals(output, markdown);
});
