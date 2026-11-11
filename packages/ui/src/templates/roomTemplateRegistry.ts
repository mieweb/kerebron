import { DOMOutputSpec } from 'prosemirror-model';

import { User } from '@kerebron/editor/user';

import { TemplatesRegistry } from './mod.ts';

export const roomTemplateRegistry: TemplatesRegistry = {
  'room-selector': (
    { user, roomID, roomIDs }: {
      user: User;
      roomID: string;
      roomIDs: Set<string>;
    },
  ): DOMOutputSpec => {
    const userBtn = ['button', {
      name: 'change-name-button',
      type: 'button',
    }, 'Change name'];

    const userInput = ['label', 'User', ['input', {
      type: 'text',
      size: 10,
      name: 'user-input',
      placeholder: 'Username',
      value: user.name,
    }], userBtn];

    const userGroup = [
      'fieldset',
      userInput,
      ,
    ];

    const roomElements: Array<DOMOutputSpec> = [];
    if (roomIDs.size > 0) {
      if (!roomID) {
        roomElements.push(['option', {
          value: '',
        }, 'Select room']);
      }

      for (const id of roomIDs) {
        roomElements.push(['option', {
          value: id,
          selected: (id === roomID) || undefined,
        }, id]);
      }
    }

    const newRoomBtn = ['button', {
      name: 'new-room-button',
      type: 'button',
    }, 'New room'];

    const roomSelect = ['label', 'Room', ['select', {
      name: 'room-select',
      style: (roomIDs.size > 0) ? '' : 'display: none;',
    }, ...roomElements], newRoomBtn];

    const roomGroup = [
      'fieldset',
      roomSelect,
    ];

    return [
      'form',
      {
        class: 'kb--default-template',
      },
      userGroup,
      roomGroup,
    ];
  },
};
