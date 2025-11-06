import { dracula } from 'thememirror';

import { Extension } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionOdt } from '@kerebron/extension-odt';
import { ExtensionTables } from '@kerebron/extension-tables';
import { ExtensionDevToolkit } from '@kerebron/extension-dev-toolkit';
import { ExtensionMenuLegacy } from '@kerebron/extension-menu-legacy';
import { Dropdown, MenuElement, MenuItem } from '@kerebron/extension-menu';
import { ExtensionCodeMirror } from '@kerebron/extension-codemirror';

export class AdvancedEditorKit extends Extension {
  override name = 'advanced-editor';

  requires = [
    new ExtensionBasicEditor(),
    new ExtensionMarkdown(),
    new ExtensionOdt(),
    new ExtensionTables(),
    new ExtensionDevToolkit(),
    new ExtensionMenuLegacy({
      modifyMenu: (menus: MenuElement[][]) => {
        const fileMenu = [
          new MenuItem({
            label: 'Simulate loadDoc',
            enable: () => true,
            run: () => this.loadDoc(),
          }),
          new MenuItem({
            label: 'Load',
            enable: () => true,
            run: () => this.loadDoc2(),
          }),
        ];
        menus[0].unshift(new Dropdown(fileMenu, { label: 'File' }));
        return menus;
      },
    }),
    new ExtensionCodeMirror({
      theme: [dracula],
    }),
  ];

  async loadDoc() {
    const buffer = new TextEncoder().encode(
      '# TEST \n\n1.  aaa **bold**\n2.  bbb\n\n```js\nconsole.log("TEST")\n```\n',
    );
    await this.editor.loadDocument('text/x-markdown', buffer);
    return true;
  }

  loadDoc2() {
    const input: HTMLInputElement = document.createElement('input');
    input.type = 'file';
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      console.log('Selected file:', file);
      await this.editor.loadDocument(file.type, await file.bytes());
    });
    input.click();
    return true;
  }
}
