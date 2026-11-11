import { toDOMElement } from '@kerebron/ui/utilities/toDOMElement';
import { bootstrapTemplateRegistry } from '@kerebron/ui/templates/bootstrap';

import { RoomController } from '@kerebron/yjs/ui/RoomController';

export default class YjsRoom extends HTMLElement {
  static tagName = 'my-yjs-room';

  controller = new RoomController();

  constructor() {
    super();
  }

  async connectedCallback() {
    this.controller.bindEvents(this);
    await this.controller.init();
    this.renderForm();
    this.controller.addEventListener('change-room', (event) => {
      if (!this.isConnected) {
        return;
      }
      this.renderForm();
      this.dispatchEvent(event);
    });
    this.controller.addEventListener('change-user', (event) => {
      if (!this.isConnected) {
        return;
      }
      this.renderForm();
      this.dispatchEvent(event);
    });
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
