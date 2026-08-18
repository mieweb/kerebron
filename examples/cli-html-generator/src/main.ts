import { CoreEditor } from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';
import { assetLoad } from '@kerebron/wasm/deno';

import { ExtensionMarkdown } from '@kerebron/extension-markdown';

const markdownExtension = new ExtensionMarkdown({
  sourceMap: true,
  htmlListItems: true,
  listMargins: {
    ul: 4,
  },
});

const editor = CoreEditor.create({
  assetLoad,
  editorKits: [
    new BrowserLessEditorKit(),
    {
      getExtensions() {
        return [
          markdownExtension,
        ];
      },
    },
  ],
});

async function convertMarkdownToHtml(md: Uint8Array): Promise<string> {
  await editor.loadDocument('text/x-markdown', md);
  return new TextDecoder().decode(await editor.saveDocument('text/html'));
}

async function convertMarkdownToMarkdown(md: Uint8Array): Promise<string> {
  await editor.loadDocument('text/x-markdown', md);
  return new TextDecoder().decode(await editor.saveDocument('text/x-markdown'));
}

let counter = 0;

const markDownDir = Deno.args[0];
if (!markDownDir) {
  throw new Error('First arg should be content directory');
}
const destDir = Deno.args[1];
if (!destDir) {
  throw new Error('Second arg should be destination directory');
}

async function readMarkdownFiles(dir: string, outDir: string): Promise<void> {
  try {
    for await (const entry of Deno.readDir(dir)) {
      const path = `${dir}/${entry.name}`;
      const relativePath = path.substring(markDownDir.length);
      const fileName = relativePath.split('/').pop();

      if (entry.isDirectory) {
        const destSubDir = outDir + relativePath;
        await Deno.mkdir(destSubDir, {
          recursive: true,
        });
        await readMarkdownFiles(path, outDir); // Recursive call for subdirectories
      } else if (entry.isFile && path.endsWith('.md')) {
        try {
          const content = await Deno.readFile(path);
          const html = await convertMarkdownToHtml(content);

          await Deno.writeTextFile(
            outDir + relativePath.replace('.md', '.html'),
            html,
          );

          counter++;
        } catch (error: any) {
          console.error(`${path}:`, error);
          Deno.exit(1);
        }
      }
    }
  } catch (error) {
    console.error(`Error accessing directory ${dir}:`, error);
  }
}

await readMarkdownFiles(markDownDir, destDir);

console.log('Files transformed:', counter);
