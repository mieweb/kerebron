// import { DOMParser } from 'jsr:@b-fuze/deno-dom'; // No xml support (mathML) https://github.com/b-fuze/deno-dom/issues?q=is%3Aissue%20state%3Aopen%20xml
import { DOMParser, parseHTML } from 'npm:linkedom';

import { XMLSerializer } from 'npm:xmldom';

import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionTables } from '@kerebron/extension-tables';
import { NodeCodeMirror } from '@kerebron/extension-codemirror';

globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;
const doc = new DOMParser().parseFromString(
  '<html><body></body></html>',
  'text/html',
)!;
// const doc = new DOMParser().parseFromString('<html><body></body></html>', "application/xhtml+xml")!;

globalThis.document = doc;
console.log('globalThis.document', globalThis.document);

const editor = new CoreEditor({
  extensions: [
    new ExtensionBasicEditor(),
    new ExtensionMarkdown(),
    new ExtensionTables(),
    new NodeCodeMirror(),
  ],
});

async function convertMarkdown(md: Uint8Array): Promise<string> {
  await editor.loadDocument('text/x-markdown', md);
  return new TextDecoder().decode(await editor.saveDocument('text/html'));
}

let counter = 0;

const markDownDir = Deno.args[0];
if (!Deno.args[0]) {
  throw new Error('First arg should be content directory');
}
const htmlDir = '/tmp/_test_html';

async function readMarkdownFiles(dir: string, outDir: string): Promise<void> {
  try {
    for await (const entry of Deno.readDir(dir)) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory) {
        await Deno.mkdir(outDir + path.substring(markDownDir.length), {
          recursive: true,
        });
        await readMarkdownFiles(path, outDir); // Recursive call for subdirectories
      } else if (entry.isFile && path.endsWith('.md')) {
        try {
          const content = await Deno.readFile(path);
          const html = await convertMarkdown(content);
          await Deno.writeTextFile(
            outDir +
              path.substring(markDownDir.length).replace(/.md$/, '.html'),
            html,
          );
          counter++;
        } catch (error) {
          console.error(`Error reading file ${path}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Error accessing directory ${dir}:`, error);
  }
}

await readMarkdownFiles(markDownDir, htmlDir);

console.log('Files transformed:', counter);
