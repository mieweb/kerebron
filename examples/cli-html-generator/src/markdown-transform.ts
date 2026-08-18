import { CoreEditor } from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';
import { assetLoad } from '@kerebron/wasm/deno';

import {
  countDiffLines,
  diffLines,
  formatCompactDiff,
  formatDiffHeader,
  normalizeDiff,
} from '@kerebron/test-utils/Diff';
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
let incorrectMd = 0;
let errorCnt = 0;

const markDownDir = Deno.args[0];
if (!markDownDir) {
  throw new Error('First arg should be content directory');
}
const destDir = Deno.args[1];
if (!destDir) {
  throw new Error('Second arg should be destination directory');
}

const errLog = Deno.args[2]
  ? await Deno.open(Deno.args[2], {
    write: true,
    append: false,
    create: true,
    truncate: true,
  })
  : null;

const encoder = new TextEncoder();

const ansiRegex =
  // deno-lint-ignore no-control-regex
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

function stripAnsi(s: string) {
  return s.replace(ansiRegex, '');
}

function log(...args: any[]) {
  console.log(...args);
  const text = args.map(String).join(' ');
  errLog?.writeSync(encoder.encode(stripAnsi(text) + '\n'));
}
function error(...args: any[]) {
  console.error(...args);
  errLog?.writeSync(encoder.encode(args.map(String).join(' ') + '\n'));
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
          const md2 = await convertMarkdownToMarkdown(content);

          await Deno.writeTextFile(outDir + relativePath, md2);

          const md1 = new TextDecoder().decode(content);

          const diff = normalizeDiff(diffLines(md2, md1));
          const diffCnt = countDiffLines(diff);

          const total = diffCnt.added + diffCnt.removed + diffCnt.changed;
          if (diffCnt.totalNotWhitespace > 0) {
            incorrectMd++;
          }
          if (diffCnt.totalNotWhitespace > 0 && total < 10) {
            log(formatDiffHeader(path, diff, true));
            log(formatCompactDiff(diff, { colors: true }));
            log();
          }

          counter++;
        } catch (error: any) {
          const lineNo = ('cause' in error && 'lineNo' in error.cause)
            ? error.cause.lineNo
            : -1;
          if (lineNo > -1) {
            error(`${path}:${lineNo}:\n\t`, error.message);
          } else {
            error(`${path}:`, error);
            Deno.exit(1);
          }
          errorCnt++;
        }
      }
    }
  } catch (err) {
    error(`Error accessing directory ${dir}:`, err);
  }
}

await readMarkdownFiles(markDownDir, destDir);

log('Files transformed:', counter);
log('Errors:', errorCnt);
log('Incorrect MD:', incorrectMd);

errLog?.close();
