import {
  generateBlankUser,
  generateRandomUser,
  User,
} from '@kerebron/editor/user';

export class RoomController extends EventTarget {
  roomIDs: Set<string> = new Set();
  roomID = '';
  user: User = generateBlankUser();
  hashCallback: EventListenerOrEventListenerObject | undefined;

  constructor() {
    super();
  }

  async init() {
    this.hashCallback = () => this.hashChange();
    globalThis.addEventListener('hashchange', this.hashCallback);
    await this.fetch();
    this.hashChange();
  }

  async fetch() {
    // <a :href="'#room:' + id">{{ id }}</a>
    const response = await fetch('/api/rooms');
    this.roomIDs = new Set(await response.json());

    const stored = localStorage.getItem('kerebron:user');
    if (stored) {
      this.user = JSON.parse(stored);
    } else {
      this.user = generateRandomUser();
      this.onUserChange();
    }
  }

  hashChange() {
    const location = (globalThis.parent.location !== globalThis.location)
      ? globalThis.parent.location
      : globalThis.location;
    if (location.hash.startsWith('#room:')) {
      this.roomID = location.hash.substring('#room:'.length);
      this.roomIDs.add(this.roomID);
      this.onRoomChange();
    }
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
    localStorage.setItem('kerebron:user', JSON.stringify(this.user));

    const event = new CustomEvent('change-user', {
      detail: this.user,
    });
    this.dispatchEvent(event);
  }

  async newRoom() {
    const response = await fetch('/api/rooms', { method: 'POST' });
    this.roomID = await response.json();
    this.roomIDs.add(this.roomID);
    this.onRoomChange();
  }

  bindEvents(target: EventTarget) {
    target.addEventListener('submit', (event) => {
      event.preventDefault();
      this.onUserChange();
    });
    target.addEventListener('click', (event) => {
      if (event.target && 'name' in event.target) {
        event.stopPropagation();
        switch (event.target.name) {
          case 'change-name-button':
            this.onUserChange();
            break;
          case 'new-room-button':
            this.newRoom();
            break;
        }
      }
    }, true);

    target.addEventListener('change', (event) => {
      if (event.target && 'name' in event.target) {
        event.stopPropagation();
        switch (event.target.name) {
          case 'room-select':
            if (!(event.target as HTMLSelectElement).value) {
              return;
            }
            this.roomID = (event.target as HTMLSelectElement).value;
            this.onRoomChange();
            break;
          case 'user-input':
            if (!(event.target as HTMLInputElement).value) {
              return;
            }

            if (!this.user.id) {
              this.user = generateRandomUser();
            }
            this.user.name = (event.target as HTMLInputElement).value;
            this.onUserChange();
            break;
        }
      }
    }, true);
  }

  destroy() {
    if (this.hashCallback) {
      globalThis.addEventListener('hashchange', this.hashCallback);
      this.hashCallback = undefined;
    }
  }
}
