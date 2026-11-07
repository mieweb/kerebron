import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';
import { createAssetLoad } from '@kerebron/wasm/web';

import { LspEditorKit } from '@kerebron/lsp/LspEditorKit';
import { LSPWebSocketTransport } from '@kerebron/lsp/LSPWebSocketTransport';
import { LSPTransportGetter, Transport } from '@kerebron/lsp';
import { attachMarkdownPreview } from './attachMarkdownPreview.ts';
import { attachMenu } from './attachMenu.ts';

const getLspTransport: LSPTransportGetter = (
  lang: string,
): Transport | undefined => {
  const protocol = globalThis.location.protocol === 'http:' ? 'ws:' : 'wss:';
  const uri = protocol + '//' + globalThis.location.host + '/lsp';

  switch (lang) {
    case 'markdown':
      return new LSPWebSocketTransport(uri + '/mine');
    case 'json':
      return new LSPWebSocketTransport(uri + '/deno');
    case 'typescript':
    case 'javascript':
      return new LSPWebSocketTransport(uri + '/deno');
      return new LSPWebSocketTransport(uri + '/typescript');
    case 'yaml':
      return new LSPWebSocketTransport(uri + '/yaml');
  }
  return undefined;
};

const editor = CoreEditor.create({
  uri: 'file:///test.md',
  assetLoad: createAssetLoad('/wasm'),
  element: document.getElementById('editor')!,
  editorKits: [
    new AdvancedEditorKit(),
    LspEditorKit.createFrom({ getLspTransport }),
  ],
});

attachMarkdownPreview(editor);
attachMenu(editor);

const example = await import('./example.md?raw');
const buffer = new TextEncoder().encode(example.default);
await editor.loadDocument('text/x-markdown', buffer);
