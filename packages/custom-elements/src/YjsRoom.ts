export default class YjsRoom extends HTMLElement {
  static tagName = 'my-yjs-room';
  roomIDs: Set<string> = new Set();
  roomID = '';
  roomSelect: HTMLSelectElement | undefined;
  userName = '';
  hashCallback: EventListenerOrEventListenerObject | undefined;

  constructor() {
    super();
  }

  createForm(): { form: HTMLFormElement } {
    // <form class="d-flex justify-content-end">
    const form = document.createElement('form');
    form.className = 'd-flex justify-content-end';

    // --- Username group ---
    // <div class="input-group w-auto me-3">
    const userGroup = document.createElement('div');
    userGroup.className = 'input-group w-auto me-3';

    // <span class="input-group-text">@</span>
    const userPrefix = document.createElement('span');
    userPrefix.className = 'input-group-text';
    userPrefix.textContent = '@';

    // <input type="text" class="form-control" size="10" placeholder="Username">
    const userInput = document.createElement('input');
    userInput.type = 'text';
    userInput.className = 'form-control';
    userInput.size = 10;
    userInput.placeholder = 'Username';

    userInput.addEventListener('change', (event) => {
      if (!userInput.value) {
        return;
      }
      this.userName = userInput.value;
      this.onUserChange();
    });

    userGroup.append(userPrefix, userInput);

    // --- Room group ---
    // <div class="input-group w-auto">
    const roomGroup = document.createElement('div');
    roomGroup.className = 'input-group w-auto';

    // <span class="input-group-text">Room</span>
    const roomLabel = document.createElement('span');
    roomLabel.className = 'input-group-text';
    roomLabel.textContent = 'Room';

    // <select class="form-control">
    this.roomSelect = document.createElement('select');
    this.roomSelect.className = 'form-control';
    this.roomSelect.style.display = 'none';

    this.roomSelect.addEventListener('change', (event) => {
      if (!this.roomSelect?.value) {
        return;
      }
      this.roomID = this.roomSelect.value;
      this.onRoomChange();
    });

    // <button class="btn btn-secondary">New room</button>
    const newRoomBtn = document.createElement('button');
    newRoomBtn.className = 'btn btn-secondary';
    newRoomBtn.textContent = 'New room';
    newRoomBtn.type = 'button';
    newRoomBtn.addEventListener('click', () => this.newRoom());

    roomGroup.append(roomLabel, this.roomSelect, newRoomBtn);

    // Assemble form
    form.append(userGroup, roomGroup);

    return { form };
  }

  onRoomChange() {
    if (!this.roomID) {
      return;
    }
    const location = (globalThis.parent.location !== globalThis.location)
      ? globalThis.parent.location
      : globalThis.location;
    location.hash = 'room:' + this.roomID;
    const event = new CustomEvent('change-room', {
      detail: this.roomID,
    });
    this.dispatchEvent(event);
  }

  onUserChange() {
    if (!this.userName) {
      return;
    }
    const event = new CustomEvent('change-user', {
      detail: this.userName,
    });
    this.dispatchEvent(event);
  }

  hashChange() {
    const location = (globalThis.parent.location !== globalThis.location)
      ? globalThis.parent.location
      : globalThis.location;
    if (location.hash.startsWith('#room:')) {
      this.roomID = location.hash.substring('#room:'.length);
      this.roomIDs.add(this.roomID);
      this.renderDropDown();
      this.onRoomChange();
    }
  }

  connectedCallback() {
    const { form } = this.createForm();
    this.appendChild(form);
    this.fetch();
    this.hashCallback = () => this.hashChange();
    globalThis.addEventListener('hashchange', this.hashCallback);
    this.hashChange();
  }

  renderDropDown() {
    if (this.roomSelect) {
      this.roomSelect.innerHTML = '';
      if (this.roomIDs.size > 0) {
        this.roomSelect.style.display = '';
        if (!this.roomID) {
          const option = document.createElement('option');
          option.textContent = 'Select room';
          option.value = '';
          this.roomSelect.appendChild(option);
        }

        for (const roomId of this.roomIDs) {
          const option = document.createElement('option');
          option.textContent = roomId;
          option.value = roomId;
          if (roomId === this.roomID) {
            option.selected = true;
          }
          this.roomSelect.appendChild(option);
        }
      } else {
        this.roomSelect.style.display = 'none';
      }
    }
  }

  async fetch() {
    // <a :href="'#room:' + id">{{ id }}</a>
    const response = await fetch('/api/rooms');
    this.roomIDs = new Set(await response.json());
    this.renderDropDown();
  }

  async newRoom() {
    const response = await fetch('/api/rooms', { method: 'POST' });
    this.roomID = await response.json();
    this.roomIDs.add(this.roomID);
    this.renderDropDown();
    this.onRoomChange();
  }

  disconnectedCallback() {
    if (this.hashCallback) {
      globalThis.addEventListener('hashchange', this.hashCallback);
      this.hashCallback = undefined;
    }
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
