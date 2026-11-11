import { DOMOutputSpec } from 'prosemirror-model';

import { User } from '@kerebron/editor/user';

import { TemplatesRegistry } from '../mod.ts';

export const bootstrapTemplateRegistry: TemplatesRegistry = {
  'room-selector': (
    { user, roomID, roomIDs }: {
      user: User;
      roomID: string;
      roomIDs: Set<string>;
    },
  ): DOMOutputSpec => {
    // Bootstrap styling

    // --- Username group ---
    // <span class="input-group-text">@</span>
    const userPrefix = ['span', {
      class: 'input-group-text',
    }, '@'];

    // <input type="text" class="form-control" size="10" placeholder="Username">
    const userInput = ['input', {
      type: 'text',
      class: 'form-control',
      size: 10,
      name: 'user-input',
      placeholder: 'Username',
      value: user.name,
    }];

    const userBtn = ['button', {
      name: 'change-name-button',
      type: 'button',
      class: 'btn btn-secondary',
    }, 'Change name'];

    // <div class="input-group w-auto me-3">
    const userGroup = [
      'div',
      {
        class: 'input-group w-auto me-3',
      },
      userPrefix,
      userInput,
      userBtn,
    ];

    // --- Room group ---
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

    // <span class="input-group-text">Room</span>
    const roomLabel = ['span', {
      class: 'input-group-text',
    }, 'Room'];

    // <select class="form-control">
    const roomSelect = ['select', {
      name: 'room-select',
      class: 'form-control',
      style: (roomIDs.size > 0) ? '' : 'display: none;',
    }, ...roomElements];

    // <button class="btn btn-secondary">New room</button>
    const newRoomBtn = ['button', {
      name: 'new-room-button',
      type: 'button',
      class: 'btn btn-secondary',
    }, 'New room'];

    // <div class="input-group w-auto">
    const roomGroup = [
      'div',
      {
        class: 'input-group w-auto',
      },
      roomLabel,
      roomSelect,
      newRoomBtn,
    ];

    // <form class="d-flex justify-content-end">
    return [
      'form',
      {
        class: 'd-flex justify-content-end',
      },
      userGroup,
      roomGroup,
    ];
  },
};
