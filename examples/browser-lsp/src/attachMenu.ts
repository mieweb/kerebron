import { CoreEditor } from '@kerebron/editor';
import { MenuDropdown } from '@kerebron/menu';

export function attachMenu(editor: CoreEditor) {
  const loadDoc = () => {
    const input: HTMLInputElement = document.createElement('input');
    input.type = 'file';
    input.accept =
      '.md,.odt,text/markdown,application/vnd.oasis.opendocument.text';
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      console.log('Selected file:', file);
      await editor.loadDocument(
        file.type,
        new Uint8Array(await file.arrayBuffer()),
      );
    });
    input.click();
    return true;
  };

  const saveMd = async () => {
    const filename = globalThis.prompt('Enter filename:', 'document.md');
    if (!filename) return;

    const mimeType = 'text/x-markdown';
    const data = await editor.saveDocument(mimeType);

    const buffer = new ArrayBuffer(data.byteLength);
    new Uint8Array(buffer).set(data);

    const blob = new Blob([buffer], { type: mimeType });

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const loadExample = async () => {
    const example = await import('./example.md?raw');
    const buffer = new TextEncoder().encode(example.default);
    await editor.loadDocument('text/x-markdown', buffer);
    return true;
  };

  const loadLspToy = async () => {
    const example = await import('./example.lsptoy?raw');
    await editor.loadDocument(
      'text/x-markdown',
      new TextEncoder().encode(example.default),
    );
    return true;
  };

  const menuFile: MenuDropdown = {
    type: 'dropdown',
    id: 'file',
    title: 'File',
    items: [
      {
        type: 'item',
        id: 'load-file',
        title: 'Load file',
        action: (_editor) => loadDoc(),
      },
      {
        type: 'item',
        id: 'save-md',
        title: 'Save markdown',
        action: (_editor) => saveMd(),
      },
      {
        type: 'item',
        id: 'myitem',
        title: 'Load example.md',
        action: async (_editor) => {
          loadExample();
        },
      },
      {
        type: 'item',
        id: 'load-lsptoy',
        title: 'Load example.lsptoy',
        action: async (_editor) => {
          loadLspToy();
        },
      },
    ],
  };

  editor.run.addMenuItem(menuFile, 0);
}
