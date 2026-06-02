import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';
import { createAssetLoad } from '@kerebron/wasm/web';

const richEditor = document.getElementById('editor');
const textEditor = document.getElementById('preview') as HTMLTextAreaElement;
if (!richEditor) {
  throw new Error('No editor element');
}
if (!textEditor) {
  throw new Error('No preview element');
}

const buffer = new TextEncoder().encode(
  richEditor.innerHTML,
);
richEditor.innerHTML = '';

const editor1 = CoreEditor.create({
  uri: 'test.md',
  assetLoad: createAssetLoad('/wasm'),
  element: document.getElementById('editor') || undefined,
  editorKits: [
    new AdvancedEditorKit(),
  ],
});

async function pmToMd() {
  const buffer = await editor1.saveDocument('text/x-markdown');
  textEditor.value = new TextDecoder().decode(buffer);
}

editor1.addEventListener('changed', () => {
  pmToMd();
});

async function mdToPm() {
  const md = textEditor?.value || '';
  const buffer = new TextEncoder().encode(
    md,
  );
  await editor1.loadDocument('text/x-markdown', buffer);
}

textEditor.addEventListener('keyup', () => {
  mdToPm();
});

await editor1.loadDocument('text/html', buffer);
await pmToMd();
