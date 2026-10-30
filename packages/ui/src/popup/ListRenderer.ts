import { DOMOutputSpec } from 'prosemirror-model';

export interface ListItem {
  value: string;
  label: string;
}

export class ListRenderer {
  createListItem(item: ListItem, active: boolean): DOMOutputSpec {
    return [
      'option',
      {
        class: active ? 'active' : undefined,
        tabIndex: 0,
        style: 'cursor: pointer;',
        value: item.value,
      },
      item.label,
    ];
  }

  renderList(items: ListItem[], pos: number = -1): DOMOutputSpec {
    const list: DOMOutputSpec = [
      'select',
      { size: items.length },
      ...items.map((i, cnt) => this.createListItem(i, cnt === pos)),
    ];
    return list;
  }
}
