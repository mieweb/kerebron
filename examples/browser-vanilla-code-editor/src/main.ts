import * as Y from 'yjs';

import { CoreEditor } from '@kerebron/editor';
import { LspEditorKit } from '@kerebron/editor-kits/LspEditorKit';
import { CodeEditorKit } from '@kerebron/editor-kits/CodeEditorKit';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';
import type { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { PositionMapper } from '@kerebron/extension-markdown/PositionMapper';

window.addEventListener('load', async () => {
  const docUrl = globalThis.location.hash.slice(1);
  let roomId;
  if (docUrl.startsWith('room:')) {
    roomId = docUrl.substring('room:'.length);
  } else {
    roomId = String(Math.random());
    globalThis.location.hash = 'room:' + roomId;
  }
  const ydoc = new Y.Doc();

  const editor = new CoreEditor({
    uri: 'test.yaml',
    topNode: 'doc_code',
    element: document.getElementById('editor') || undefined,
    extensions: [
      new CodeEditorKit('yaml'),
      YjsEditorKit.createFrom(ydoc, roomId),
      await LspEditorKit.createFrom(),
    ],
    // content: pmDoc
  });

  editor.addEventListener('selection', (event: CustomEvent) => {
    const selection = event.detail.selection;
    const extensionMarkdown: ExtensionMarkdown | undefined = editor
      .getExtension('markdown');
    if (extensionMarkdown) {
      const result = extensionMarkdown.toMarkdown(editor.state.doc);
      const md = result.content;

      const mapper = new PositionMapper(editor, result.markdownMap);
      const from = mapper.toMarkDownPos(selection.from);
      const to = mapper.toMarkDownPos(selection.to);

      if (from > -1 && to > -1) {
        const parts = [
          md.substring(0, from),
          md.substring(from, to),
          md.substring(to),
        ];
        const preHtml = '<span>' + parts[0] + '</span>' +
          '<span class="md-selected">' + parts[1] + '</span>' +
          '<span>' + parts[2] + '</span>';

        document.getElementById('markdown').innerHTML = preHtml;
      } else {
        return md;
      }
    }
  });

  editor.addEventListener('transaction', async (ev: CustomEvent) => {
    // console.trace();
    return;
    const lastValue = ev.detail.transaction.doc;
    const buffer = await editor.saveDocument('text/code-only');
    console.log('buffer', buffer);
    const code = new TextDecoder().decode(buffer);
    // this.$emit('input', this.lastValue);
  });

  document.getElementById('loadDoc')?.addEventListener('click', async () => {
    const buffer = new TextEncoder().encode(
      '# Multiline string with literal block syntax -preserved new lines\n' +
        'string1: |\n' +
        '   Line1\n' +
        '   line2\n' +
        '   "line3"\n' +
        '  line4\n',
    );
    await editor.loadDocument('text/code-only', buffer);
  });
});
