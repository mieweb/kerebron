import { DOMOutputSpec } from 'prosemirror-model';

import { TemplatesRegistry } from './mod.ts';

interface ListItem {
  value: string;
  label: string;
}

export const popupTemplateRegistry: TemplatesRegistry = {
  'dropdown-list': ({ items, pos }: { items: ListItem[]; pos: number }) => {
    const createListItem = (item: ListItem, active: boolean): DOMOutputSpec => {
      return [
        'option',
        {
          selected: active ? '' : undefined,
          tabIndex: 0,
          style: 'cursor: pointer;',
          value: item.value,
        },
        item.label,
      ];
    };

    const list: DOMOutputSpec = [
      'select',
      { size: items.length },
      ...items.map((i, cnt) => createListItem(i, cnt === pos)),
    ];
    return list;
  },
  'insert-image': ({ attrs }) => {
    return [
      'form',
      {
        class: 'kb--default-template',
      },
      [
        'header',
        'Insert image',
      ],
      [
        'fieldset',
        ['label', 'Choose image', ['input', {
          type: 'file',
          accept: 'image/*',
          required: true,
        }]],

        ['label', 'Title', ['input', {
          name: 'title',
          value: attrs && attrs.title,
        }]],
        ['label', 'Description', ['input', {
          name: 'alt',
          value: attrs && attrs.alt,
        }]],
        ,
      ],
      ['footer', ['button', { type: 'submit' }, 'Submit']],
    ];
  },
  'insert-link': ({ attrs }) => {
    return [
      'form',
      {
        class: 'kb--default-template',
      },
      [
        'header',
        'Create a link',
      ],
      [
        'fieldset',
        ['label', 'Link target', ['input', {
          name: 'href',
          value: attrs && attrs.href,
          required: true,
        }]],

        ['label', 'Title', ['input', {
          name: 'title',
          value: attrs && attrs.title,
        }]],
      ],
      ['footer', ['button', { type: 'submit' }, 'Submit']],
    ];
  },
  'dialog-search': ({ text }: { text: string }) => {
    return [
      'form',
      {
        class: 'kb--default-template',
      },
      [
        'header',
        'Search',
      ],
      [
        'fieldset',
        ['label', 'Text', ['input', {
          name: 'search',
          value: text,
          tabindex: 1,
        }]],
      ],
      ['footer', [
        'button',
        { type: 'submit', name: 'prev', tabindex: 3 },
        'Prev',
      ], ['button', { type: 'submit', name: 'next', tabindex: 2 }, 'Next']],
    ];
  },
  'dialog-replace': ({ text, replace }: { text: string; replace: string }) => {
    return [
      'form',
      {
        class: 'kb--default-template',
      },
      [
        'header',
        'Search & Replace',
      ],
      [
        'fieldset',
        ['label', 'Search', ['input', { name: 'search', value: text }]],

        ['label', 'Replace', ['input', { name: 'replace', value: replace }]],
      ],
      ['footer', [
        'button',
        { type: 'submit', name: 'replace_next' },
        'Replace',
      ], [
        'button',
        { type: 'submit', name: 'replace_all' },
        'Replace all',
      ]],
    ];
  },
};
