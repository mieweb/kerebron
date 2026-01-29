import * as fs from 'node:fs';
import { Fragment, Node as PmNode } from 'prosemirror-model';

import { CoreEditor } from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';

import { nodeCdn } from '@kerebron/wasm/node';
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
    cdnUrl: nodeCdn(),
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
        const fileName = content.substring('SOURCE '.length)
          .replaceAll('"', '');

        const retVal: PmNode[] = [];

        retVal.push(
          editor.schema.nodes.heading?.createAndFill(
            { level: 3 },
            editor.schema.text(fileName),
          )!,
        );
        const buffer = fs.readFileSync(
          examplesDir + ctx.example + '/' + fileName,
        );
        const codeText = new TextDecoder().decode(buffer);

        retVal.push(
          editor.schema.nodes.code_block.createAndFill(
            {},
            editor.schema.text(codeText),
          )!,
        );

        return Fragment.from(retVal);
      }
    }

    return Fragment.from([
      editor.schema.text('Not defined: ' + node.attrs.content),
    ]);
  };

  editor.chain().renderShortCode(replaceFunc)
    .run();

  return new TextDecoder().decode(await editor.saveDocument('text/html'));
}
