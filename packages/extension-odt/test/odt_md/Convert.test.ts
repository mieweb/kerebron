import { assertEquals } from '@std/assert';

// import { DOMParser } from 'jsr:@b-fuze/deno-dom'; // No xml support (mathML) https://github.com/b-fuze/deno-dom/issues?q=is%3Aissue%20state%3Aopen%20xml
import { DOMParser, parseHTML } from 'npm:linkedom@latest';
import { XMLSerializer } from 'npm:xmldom@latest';

import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor/ExtensionBasicEditor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionOdt } from '@kerebron/extension-odt';
import { ExtensionTables } from '@kerebron/extension-tables';
import { NodeCodeBlock } from '@kerebron/extension-basic-editor/NodeCodeBlock';
import { denoCdn } from '@kerebron/wasm/deno';
import { urlToFolderId } from './idParsers.ts';

globalThis.DOMParser = DOMParser as any;
globalThis.XMLSerializer = XMLSerializer;
const doc = new DOMParser().parseFromString(
  '<html><body></body></html>',
  'text/html',
)!;

globalThis.document = doc as any;

const __dirname = import.meta.dirname;

Deno.test('convert odt to md', async () => {
  // const serializerDebug = console.debug;
  const serializerDebug = undefined;
  const extMd = new ExtensionMarkdown({
    debugTokens: true,
    serializerDebug,
    cdnUrl: denoCdn(),
  });
  const extOdt = new ExtensionOdt({
    debug: true,
    postProcessCommands: [],
  });

  const extensions = [
    new ExtensionBasicEditor(),
    new NodeCodeBlock(),
    new ExtensionTables(),
    extMd,
    extOdt,
  ];

  const editor = new CoreEditor({
    extensions,
  });

  extOdt.urlFromRewriter = (href, ctx) => {
    if (ctx.type === 'A') {
      const id = urlToFolderId(href);
      if (id) {
        href = 'gdoc:' + id;
      }
    }
    if (ctx.type === 'IMG') {
      href = href.replace(/^Pictures\//, '');
    }
    return href;
  };

  // extMd.urlToRewriter = (href, ctx) => {
  //   if (ctx.type === 'A') {
  //     href='test1';
  //   }
  //   if (ctx.type === 'IMG') {
  //     href='test2';
  //   }
  //   return href;
  // };

  const input = Deno.readFileSync(__dirname + '/example-document.odt');

  editor.addEventListener(
    'odt:parsed',
    ((event: CustomEvent) => {
      const { stylesTree, contentTree, filesMap } = event.detail;
      Deno.writeTextFileSync(
        __dirname + '/example-document.debug.odt.content.json',
        JSON.stringify(contentTree, null, 2),
      );
    }) as EventListener,
  );

  editor.addEventListener(
    'md:tokens',
    ((event: CustomEvent) => {
      const { tokens } = event.detail;
      Deno.writeTextFileSync(
        __dirname + '/example-document.debug.md.tokens.json',
        JSON.stringify(tokens, null, 2),
      );
    }) as EventListener,
  );

  await editor.loadDocument('application/vnd.oasis.opendocument.text', input);

  const json = editor.getDocument().toJSON();
  Deno.writeTextFileSync(
    __dirname + '/example-document.debug.pmdoc.json',
    JSON.stringify(json, null, 2),
  );

  const buffer = await editor.saveDocument('text/x-markdown');
  const md = new TextDecoder().decode(buffer);

  const referenceMd = new TextDecoder().decode(
    Deno.readFileSync(__dirname + '/example-document.md'),
  );
  assertEquals(md, referenceMd);
});
