import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';
import { createAssetLoad } from '@kerebron/wasm/web';

import { YjsEditorKit } from '@kerebron/yjs/YjsEditorKit';
import { attachMenu } from './attachMenu.ts';

const editor = CoreEditor.create({
  uri: 'file:///test.md',
  assetLoad: createAssetLoad('/wasm'),
  element: document.getElementById('editor')!,
  editorKits: [
    new AdvancedEditorKit(),
    YjsEditorKit.createFrom({ addMenu: true }),
  ],
});

attachMenu(editor);

const example = await import('./example.md?raw');
const buffer = new TextEncoder().encode(example.default);
await editor.loadDocument('text/x-markdown', buffer);
