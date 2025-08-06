import { assertEquals } from '@std/assert';

import { DOMParser } from 'jsr:@b-fuze/deno-dom';
// import w3cserializer from 'npm:w3c-xmlserializer';
import { XMLSerializer } from 'npm:xmldom';

// class XMLSerializer {
//   serializeToString(param) {
//     console.log(param);
//     param.namespaceURI = "http://www.w3.org/1999/xhtml";
//     return w3cserializer(param);
//   }
// }

globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;
const doc = new DOMParser().parseFromString(
  '<html><body></body></html>',
  'text/html',
)!;
// const doc = new DOMParser().parseFromString('<html><body></body></html>', "application/xhtml+xml")!;

globalThis.document = doc;

// doc.namespaceURI = "http://www.w3.org/1999/xhtml";

console.log('document', doc.body.namespaceURI);

import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionOdt } from '@kerebron/extension-odt';
import { ExtensionTables } from '@kerebron/extension-tables';
import { NodeCodeMirror } from '@kerebron/extension-codemirror';

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

  // const extensionManager = new ExtensionManager(extensions, this);

  const editor = new CoreEditor({
    extensions,
  });

  const input = Deno.readFileSync(__dirname + '/example-document.odt');

  await editor.loadDocument('application/vnd.oasis.opendocument.text', input);

  const json = editor.getDocument().toJSON();

  // console.log(json);

  const buffer = await editor.saveDocument('text/x-markdown');
  const md = new TextDecoder().decode(buffer);

  console.log('MD', md);

  // extMd.getConverters(editor, schema);
  // console.log(editor.getDocument().toJSON())
  // assertEquals(x, 5);
});
