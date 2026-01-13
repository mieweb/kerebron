import { CoreEditor } from '@kerebron/editor';
import { DevAdvancedEditorKit } from '@kerebron/editor-kits/DevAdvancedEditorKit';
import { BasicEditorKit } from '@kerebron/extension-basic-editor/BasicEditorKit';

import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
mermaid.initialize({ startOnLoad: true });

const editor1 = CoreEditor.create({
  uri: 'test.md',
  cdnUrl: '/wasm/',
  element: document.getElementById('editor') || undefined,
  editorKits: [
    new DevAdvancedEditorKit(),
  ],
});

const editor2 = editor1.clone({
  editorKits: [
    new BasicEditorKit(),
  ],
  readOnly: true,
});

editor2.link(editor1)
  .run();

function renderMermaid() {
  mermaid.run({
    querySelector: 'pre[lang=mermaid] code',
  });
}

editor2.addEventListener('changed', async () => {
  const buffer = await editor2.saveDocument('text/html');
  const prevElement = document.getElementById('preview');
  if (!prevElement) {
    return;
  }
  prevElement.innerHTML = new TextDecoder().decode(buffer);
  renderMermaid();
});

const buffer = new TextEncoder().encode(
  '```mermaid\n' +
    'sequenceDiagram\n' +
    '    participant Alice\n' +
    '    participant Bob\n' +
    '    Alice->>John: Hello John, how are you?\n' +
    '    loop HealthCheck\n' +
    '        John->>John: Fight against hypochondria\n' +
    '    end\n' +
    '    Note right of John: Rational thoughts <br/>prevail!\n' +
    '    John-->>Alice: Great!\n' +
    '    John->>Bob: How about you?\n' +
    '    Bob-->>John: Jolly good!\n' +
    '```\n',
);
await editor1.loadDocument('text/x-markdown', buffer);
