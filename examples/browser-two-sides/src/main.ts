import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';

const editorElem = document.getElementById('editor');
const prevElement = document.getElementById('preview');
if (!editorElem) {
  throw new Error('No editor element');
}
if (!prevElement) {
  throw new Error('No preview element');
}

const buffer = new TextEncoder().encode(
  editorElem.innerHTML,
);
editorElem.innerHTML = '';

const editor1 = CoreEditor.create({
  uri: 'test.md',
  cdnUrl: '/wasm/',
  element: document.getElementById('editor') || undefined,
  editorKits: [
    new AdvancedEditorKit(),
  ],
});

async function mdToPm() {
  const md = prevElement?.value || '';
  const buffer = new TextEncoder().encode(
    md,
  );
  await editor1.loadDocument('text/x-markdown', buffer);
}

async function pmToMd() {
  const buffer = await editor1.saveDocument('text/x-markdown');
  prevElement.value = new TextDecoder().decode(buffer);
}

editor1.addEventListener('changed', async () => {
  pmToMd();
});

prevElement.addEventListener('keyup', async () => {
  mdToPm();
});

await editor1.loadDocument('text/html', buffer);
await pmToMd();
