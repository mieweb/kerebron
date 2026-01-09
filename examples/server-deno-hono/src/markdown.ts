import { Fragment, Node as PmNode } from 'prosemirror-model';

import { CoreEditor } from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';

import { denoCdn } from '@kerebron/wasm/deno';

const __dirname = import.meta.dirname;

export interface MdContext {
  example?: string;
}

export async function markdownToHtml(
  md: Uint8Array,
  ctx: MdContext = {},
): Promise<string> {
  const editor = CoreEditor.create({
    cdnUrl: denoCdn(),
    editorKits: [
      new BrowserLessEditorKit(),
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

      if (content.startsWith('SOURCES ')) {
        const files = content.substring('SOURCES '.length)
          .replace(/^\[/, '').replace(/\]$/, '')
          .split(',')
          .map((name) => name.trim().replaceAll('"', ''));

        const retVal: PmNode[] = [];

        for (const fileName of files) {
          retVal.push(
            editor.schema.nodes.heading?.createAndFill(
              { level: 3 },
              editor.schema.text(fileName),
            )!,
          );
          const buffer = Deno.readFileSync(
            __dirname + '/../../' + ctx.example + '/' + fileName,
          );
          const content = new TextDecoder().decode(buffer);

          retVal.push(
            editor.schema.nodes.code_block.createAndFill(
              {},
              editor.schema.text(content),
            )!,
          );
        }

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
