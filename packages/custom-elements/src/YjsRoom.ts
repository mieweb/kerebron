import { toDOMElement } from '@kerebron/ui/utilities/toDOMElement';
import { bootstrapTemplateRegistry } from '@kerebron/ui/templates/bootstrap';

import { RoomController } from '@kerebron/yjs/ui/RoomController';

export default class YjsRoom extends HTMLElement {
  static tagName = 'my-yjs-room';

  controller = new RoomController();

  constructor() {
    super();
  }

  get roomID() {
    return this.controller.roomID;
  }

  get user() {
    return this.controller.user;
  }

  async connectedCallback() {
    this.controller.bindEvents(this);
    this.controller.addEventListener('change-room', (event) => {
      if (!this.isConnected) {
        return;
      }
      this.renderForm();
      this.dispatchEvent(
        new CustomEvent(event.type, { detail: (event as CustomEvent).detail }),
      );
    });
    this.controller.addEventListener('change-user', (event) => {
      if (!this.isConnected) {
        return;
      }
      this.renderForm();
      this.dispatchEvent(
        new CustomEvent(event.type, { detail: (event as CustomEvent).detail }),
      );
    });
    await this.controller.init();
    this.renderForm();
  }

  renderForm() {
    this.replaceChildren();
    const form = toDOMElement(
      bootstrapTemplateRegistry['room-selector'](this.controller),
    ) as HTMLFormElement;
    this.appendChild(form);
  }

  disconnectedCallback() {
    this.controller.destroy();
  }

  connectedMoveCallback() {
    console.log('Custom element moved with moveBefore()');
  }

  adoptedCallback() {
    console.log('Custom element moved to new page.');
  }

  static register() {
    if (globalThis.customElements.get(this.tagName.toLowerCase())) return false;
    globalThis.customElements.define(this.tagName.toLowerCase(), this);
  }
}
