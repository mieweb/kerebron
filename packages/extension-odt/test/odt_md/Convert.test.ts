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

Deno.test('convert odt to md', () => {
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

  editor.setDocument(input, 'application/vnd.oasis.opendocument.text');

  const json = editor.getDocument().toJSON();

  // console.log(json);

  const md = editor.getDocument('text/x-markdown');

  console.log('MD', md);

  // extMd.getConverters(editor, schema);

  // editor.setDocument('# TEST \n\n1.  aaa **bold**\n2.  bbb\n\n```js\nconsole.log("TEST")\n```\n', 'text/x-markdown');
  // console.log(editor.getDocument().toJSON())

  // assertEquals(x, 5);
});
