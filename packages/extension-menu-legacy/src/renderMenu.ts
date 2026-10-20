import { DOMOutputSpec, MarkType, NodeType } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';

import { toDOMElement } from '@kerebron/ui/utilities/toDOMElement';

import { getIcon } from '@kerebron/ui/icons';
import { CoreEditor } from '@kerebron/editor';
import { type Ui } from '@kerebron/ui';

import { MenuBar, MenuNode } from './model.ts';

export function markActive(state: EditorState, type: MarkType) {
  let { from, $from, to, empty } = state.selection;
  if (empty) return !!type.isInSet(state.storedMarks || $from.marks());
  else return state.doc.rangeHasMark(from, to, type);
}

export function nodeActive(state: EditorState, nodeTypes: NodeType[]) {
  let { from, to } = state.selection;
  let retVal = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (nodeTypes.includes(node.type)) {
      retVal = true;
    }
  });
  return retVal;
}

export function topNodeActive(
  state: EditorState,
  nodeTypes: NodeType[],
): boolean {
  const { from, to } = state.selection;
  let pos = 0;
  for (let i = 0; i < state.doc.childCount; i++) {
    const node = state.doc.child(i);
    const start = pos;
    const end = start + node.nodeSize;

    if (start < to && end > from && nodeTypes.includes(node.type)) {
      return true;
    }

    pos = end;
  }
  return false;
}

export function renderItems(
  items: MenuNode[],
  editor: CoreEditor,
): DOMOutputSpec[] {
  return items.map((item) => {
    switch (item.type) {
      case 'item': {
        const children = [];
        const classList = ['kb-menu__item'];
        if (item.active?.(editor)) {
          classList.push('kb--active');
        }
        if (item.can && !item.can?.(editor)) {
          classList.push('kb--disabled');
        }
        if (item.icon && 'root' in editor.view) {
          children.push(getIcon(item.icon, editor.view.root));
        }
        children.push(['span', { class: 'title' }, item.title]);
        return ['li', {
          role: 'button',
          tabindex: '0',
          class: classList.join(' '),
          'data-menu-id': item.id,
          'data-anchor': '--menuitem-' + item.id,
        }, ...children];
      }

      case 'separator':
        return ['li', {
          class: 'kb-menu__separator',
          'data-menu-id': item.id,
          'data-anchor': '--menuitem-' + item.id,
        }];

      case 'dropdown': {
        const children = [];
        const classList = ['kb-menu__item'];
        if (item.active?.(editor)) {
          classList.push('kb--active');
        }
        if (item.can && !item.can?.(editor)) {
          classList.push('kb--disabled');
        }
        if (item.icon && 'root' in editor.view) {
          children.push(getIcon(item.icon, editor.view.root));
        }
        children.push(['span', { class: 'title' }, item.title]);
        children.push(['span', { class: 'kb-chevron' }, '&#x25BC;']); // &#x25B2; and &#x25BC;
        return ['li', {
          role: 'button',
          tabindex: '0',
          class: classList.join(' '),
          'data-menu-id': item.id,
          'data-anchor': '--menuitem-' + item.id,
        }, ...children];
      }
    }
  });
}

export function renderMenu(
  menuElement: HTMLElement,
  menuBar: MenuBar,
  editor: CoreEditor,
): { update: () => void } {
  const update = () => {
    menuElement.innerHTML = '';
    const menuBarElement = toDOMElement([
      'ul',
      { class: 'kb-menu__bar' },
      ...renderItems(menuBar.items, editor),
    ]);

    menuElement.appendChild(menuBarElement);

    const trayElement = toDOMElement([
      'ul',
      { class: 'kb-menu__tray' },
      ...renderItems(menuBar.tray, editor),
    ]);

    menuElement.appendChild(trayElement);
  };

  update();

  editor.addEventListener('selection', () => {
    update();
  });
  editor.addEventListener('changed', () => {
    update();
  });

  return { update };
}

export function renderDropdown(
  items: MenuNode[],
  editor: CoreEditor,
  parentId: string,
): DOMOutputSpec {
  const elements = items.map((item) => {
    switch (item.type) {
      case 'item': {
        const children = [];
        if (item.icon && 'root' in editor.view) {
          children.push(getIcon(item.icon, editor.view.root));
        }
        const classList = ['kb-menu__item'];
        if (item.active?.(editor)) {
          classList.push('kb--active');
        }
        if (item.can && !item.can?.(editor)) {
          classList.push('kb--disabled');
        }
        children.push(['span', { class: 'title' }, item.title]);
        return ['li', {
          role: 'button',
          tabindex: '0',
          class: classList.join(' '),
          'data-menu-parent-id': parentId,
          'data-menu-id': item.id,
          'data-anchor': '--menuitem-' + item.id,
        }, ...children];
      }

      case 'separator':
        return ['li', {
          class: 'kb-menu__separator',
          'data-menu-parent-id': parentId,
          'data-menu-id': item.id,
          'data-anchor': '--menuitem-' + item.id,
        }];

      case 'dropdown': {
        const children = [];
        const classList = ['kb-menu__item'];
        if (item.active?.(editor)) {
          classList.push('kb--active');
        }
        if (item.can && !item.can?.(editor)) {
          classList.push('kb--disabled');
        }
        if (item.icon && 'root' in editor.view) {
          children.push(getIcon(item.icon, editor.view.root));
        }
        children.push(['span', { class: 'title' }, item.title]);
        children.push(['span', { class: 'kb-chevron' }, '&#x25BC;']); // &#x25B2; and &#x25BC;
        return ['li', {
          role: 'button',
          tabindex: '0',
          class: classList.join(' '),
          'data-menu-parent-id': parentId,
          'data-menu-id': item.id,
          'data-anchor': '--menuitem-' + item.id,
        }, ...children];
      }
    }
  });

  return [
    'ul',
    { class: 'kb-dropdown' },
    ...elements,
  ];
}
