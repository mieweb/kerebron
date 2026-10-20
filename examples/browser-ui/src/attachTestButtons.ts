import { CoreEditor } from '@kerebron/editor';
import type { Ui } from '@kerebron/ui';
import { toDOMElement } from '@kerebron/ui/utilities/toDOMElement';
import { createAssetLoad } from '@kerebron/wasm/web';
import { DevAdvancedEditorKit } from '@kerebron/editor-kits/DevAdvancedEditorKit';

export function attachTestButtons(editor: CoreEditor) {
  const testTools = document.getElementById('test-tools');
  const ui: Ui = editor.ci.resolve('ui');

  {
    const button1 = toDOMElement(['button', { class: 'btn' }, 'Test Popup']);
    testTools?.appendChild(button1);
    button1.addEventListener('click', async () => {
      const popup = ui.createPopup({
        id: 'anchortargetforcustompopup',
        layer: 'overlayer',
      });
      await ui.setPopupContent(popup, ['div', 'Test Text']);
    });
  }

  {
    const button1 = toDOMElement(['button', { class: 'btn' }, 'Test Markdown']);
    testTools?.appendChild(button1);
    button1.addEventListener('click', async () => {
      const popup = ui.createPopup({
        id: 'anchortargetforcustompopup',
        // anchorId: diagAnchor123 ? diagAnchor123.dataset.anchor : undefined,
        layer: 'overlayer',
      });
      await ui.setPopupContent(popup, [
        'markdown',
        '# Header\n\nParagraph\n\n[Test link](https://example.com)',
      ]);

      popup.addEventListener('click', (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        popup.remove();
        alert('Clicked markdown');
      });
    });
  }

  {
    const button1 = toDOMElement(['button', { class: 'btn' }, 'Test Form']);
    testTools?.appendChild(button1);
    button1.addEventListener('click', async () => {
      const popup = ui.createPopup({
        anchorId: 'center',
        backdrop: true,
        layer: 'overlayer',
        group: 'dialog',
      });
      await ui.setPopupContent(popup, [
        'form',
        [
          'fieldset',
          ['legend', 'Fieldset'],
          ['br'],
          ['label', 'Field 1', ['input', { name: 'field1' }]],
          ['br'],
          ['label', 'Field 2', ['input', { name: 'field2' }]],
        ],
        ['button', { type: 'submit' }, 'Submit'],
      ]);

      popup.addEventListener('submit', (event: SubmitEvent) => {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target as HTMLFormElement;
        const json = Object.fromEntries(new FormData(form).entries());

        alert('Submitted ' + JSON.stringify(json));
        popup.remove();
      });
    });
  }

  {
    const button1 = toDOMElement(['button', { class: 'btn' }, 'Test Emded']);
    testTools?.appendChild(button1);
    button1.addEventListener('click', async () => {
      const popup = ui.createPopup({
        id: 'anchortargetforcustompopup',
        layer: 'overlayer',
      });

      const subEditorContainer = document.createElement('div');
      CoreEditor.create({
        uri: 'test2.md',
        assetLoad: createAssetLoad('/wasm'),
        element: subEditorContainer,
        editorKits: [
          new DevAdvancedEditorKit(),
        ],
      });

      await ui.setPopupContent(popup, subEditorContainer);
      popup.addEventListener('removed', () => {
        alert('Editor removed');
      });
    });
  }
}
