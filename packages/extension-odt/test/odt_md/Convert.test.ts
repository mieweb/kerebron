import { assertEquals } from '@std/assert';

// import { DOMParser } from 'jsr:@b-fuze/deno-dom'; // No xml support (mathML) https://github.com/b-fuze/deno-dom/issues?q=is%3Aissue%20state%3Aopen%20xml
import { DOMParser, parseHTML } from 'npm:linkedom';
import { XMLSerializer } from 'npm:xmldom';

import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionOdt } from '@kerebron/extension-odt';
import { ExtensionTables } from '@kerebron/extension-tables';
import { NodeCodeMirror } from '@kerebron/extension-codemirror';

globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;
const doc = new DOMParser().parseFromString(
  '<html><body></body></html>',
  'text/html',
)!;

globalThis.document = doc;

const __dirname = import.meta.dirname;

Deno.test('convert odt to md', async () => {
  const extMd = new ExtensionMarkdown();
  const extOdt = new ExtensionOdt();

  const extensions = [
    new ExtensionBasicEditor(),
    new NodeCodeMirror(),
    new ExtensionTables(),
    extMd,
    extOdt,
  ];

  const editor = new CoreEditor({
    extensions,
  });

  const input = Deno.readFileSync(__dirname + '/example-document.odt');

  await editor.loadDocument('application/vnd.oasis.opendocument.text', input);

  const json = editor.getDocument().toJSON();
  console.log(json);

  const buffer = await editor.saveDocument('text/x-markdown');
  const md = new TextDecoder().decode(buffer);

  const referenceMd = new TextDecoder().decode(
    Deno.readFileSync(__dirname + '/example-document.md'),
  );
  assertEquals(md, referenceMd);
});
