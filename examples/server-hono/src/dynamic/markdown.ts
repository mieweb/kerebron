import * as fs from 'node:fs';
import { Fragment, Node as PmNode } from 'prosemirror-model';

import { CoreEditor } from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';

import { assetLoad } from '@kerebron/wasm/node';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';

const __dirname = import.meta.dirname;

const examplesDir = __dirname + '/../../../';

export interface MdContext {
  example?: string;
}

export async function markdownToHtml(
  md: Uint8Array,
  ctx: MdContext = {},
): Promise<string> {
  const editor = CoreEditor.create({
    assetLoad,
    editorKits: [
      new BrowserLessEditorKit(),
      {
        getExtensions() {
          return [
            new ExtensionMarkdown(),
          ];
        },
      },
    ],
  });

  await editor.loadDocument('text/x-markdown', md);

  const replaceFunc = (node: PmNode) => {
    const content: string = node.attrs.content.trim();

    if (ctx.example) {
      if (content === 'EXAMPLE') {
        return Fragment.from([
          editor.schema.text('Open', [
            editor.schema.mark('link', {
              href: `/examples-frame/${ctx.example}`,
            }),
          ]),
          editor.schema.nodes.iframe?.createAndFill({
            src: `/examples-frame/${ctx.example}`,
            class: 'example-iframe',
          }),
        ].filter((a) => !!a));
      }

      if (content.startsWith('SOURCE ')) {
        const [fileName, snippet] = content.substring('SOURCE '.length)
          .replaceAll('"', '')
          .split('#');

        const fullFileName = `/examples/${ctx.example}/${fileName}`;

        const retVal: PmNode[] = [];

        try {
          const buffer = fs.readFileSync(
            examplesDir + ctx.example + '/' + fileName,
          );
          let codeText = new TextDecoder().decode(buffer);
          const lines = codeText.split('\n');

          let start = -1;
          let end = -1;

          if (snippet) {
            for (let rowNo = 0; rowNo < lines.length; rowNo++) {
              if (start === -1 && lines[rowNo].indexOf(' ' + snippet) > -1) {
                start = rowNo;
              }
              if (end === -1 && lines[rowNo].indexOf(' /' + snippet) > -1) {
                end = rowNo;
              }
            }
          }

          if (start >= 0 && end > start) {
            codeText = lines.slice(start, end + 1)
              .map((line, no) => (no + start + 1) + ' ' + line)
              .join('\n');

            retVal.push(
              editor.schema.nodes.heading?.createAndFill(
                { level: 3 },
                editor.schema.text(`${fullFileName}:${start + 1}-${end + 1}`),
              )!,
            );
          } else {
            retVal.push(
              editor.schema.nodes.heading?.createAndFill(
                { level: 3 },
                editor.schema.text(fullFileName),
              )!,
            );
          }

          retVal.push(
            editor.schema.nodes.code_block.createAndFill(
              {
                id: crypto.randomUUID(),
              },
              editor.schema.text(codeText),
            )!,
          );

          return Fragment.from(retVal);
        } catch (err: any) {
          retVal.push(
            editor.schema.nodes.code_block.createAndFill(
              {
                id: crypto.randomUUID(),
              },
              editor.schema.text(err.message),
            )!,
          );

          return Fragment.from(retVal);
        }
      }
    }

    return Fragment.from([
      editor.schema.text('Not defined: ' + node.attrs.content),
    ]);
  };

  editor.chain().renderShortCode(replaceFunc)
    .run();

  let html = new TextDecoder().decode(await editor.saveDocument('text/html'));

  while (true) {
    let idx = html.indexOf('html preview');

    if (idx > -1) {
      const preText = html.substring(0, idx);
      const postText = html.substring(idx + 'html preview'.length);
      html = preText + 'html' + postText;

      const startOfPre = html.substring(0, idx).lastIndexOf('<pre');
      const startCode = html.indexOf('<code>', idx);
      const endCode = html.indexOf('</code>', idx);

      if (startOfPre > 0 && startCode > startOfPre && endCode > startCode) {
        const preText = html.substring(0, startOfPre);
        const postText = html.substring(startOfPre);

        const code = html.substring(startCode + '<code>'.length, endCode);

        html = preText + decodeHtml(code) + '\n' + postText;
      }
      continue;
    }

    break;
  }

  return html;
}

function decodeHtml(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
