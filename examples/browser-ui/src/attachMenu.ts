import type { CoreEditor } from '@kerebron/editor';
import type { MenuItem } from '@kerebron/menu';
import type { Ui } from '@kerebron/ui';

export function attachMenu(editor: CoreEditor) {
  const ui: Ui = editor.ci.resolve('ui');

  const menuNode: MenuItem = {
    type: 'item',
    id: 'myitem',
    title: 'Test Item',
    action: async (_editor) => {
      const popup = ui.createPopup({
        anchorId: '--menuitem-myitem',
        layer: 'overlayer',
      });
      await ui.setPopupContent(popup, [
        'markdown',
        '### Custom menu item\n\nParagraph',
      ]);
    },
  };

  editor.run.addMenuItem(menuNode);
  editor.run.removeMenuItem('highlight');
}
