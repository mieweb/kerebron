import { CoreEditor } from '@kerebron/editor';
import {
  AutocompleteRenderer,
  SuggestionKeyDownProps,
  SuggestionProps,
} from './types.ts';

const CSS_PREFIX = 'kb-autocomplete';

export class DefaultRenderer<Item> extends EventTarget
  implements AutocompleteRenderer {
  command: (props: any) => void;
  wrapper: HTMLDialogElement | undefined;
  list: HTMLElement | undefined;
  items: Array<Item> = [];
  pos: number = -1;
  props: SuggestionProps<Item, any> | undefined;
  readonly keyDownHandler: (this: HTMLElement, ev: KeyboardEvent) => any;

  constructor(private editor: CoreEditor) {
    super();
    this.command = () => {};

    this.keyDownHandler = (event) => {
      if (this.onKeyDown({ event })) {
        event.stopPropagation();
        event.preventDefault();
      }
    };
  }

  onUpdate(props: SuggestionProps<Item>) {
    this.command = props.command;
    this.items.splice(0, this.items.length, ...props.items);
    this.props = props;
    this.refresh();
  }

  destroy() {
    document.body.removeEventListener('keydown', this.keyDownHandler, {
      capture: true,
    });
    if (this.wrapper) {
      this.wrapper.parentNode?.removeChild(this.wrapper);
      this.wrapper = undefined;
      this.dispatchEvent(new Event('close'));
    }
    this.pos = -1;
  }

  onKeyDown(props: SuggestionKeyDownProps) {
    if (!this.wrapper) {
      return false;
    }
    if (this.items.length === 0) {
      return false;
    }

    if (props.event.key === 'Escape') {
      if (this.wrapper) {
        this.wrapper.parentNode?.removeChild(this.wrapper);
        this.wrapper = undefined;
        return true;
      }
    }
    if (props.event.key === 'ArrowUp') {
      if (this.pos > -1) {
        this.pos = this.pos - 1;
        this.refresh();
        return true;
      }
    }

    if (props.event.key === 'ArrowDown') {
      if (this.pos < this.items.length - 1) {
        this.pos++;
        this.refresh();
        return true;
      }
    }

    if (props.event.key === 'Enter') {
      if (this.pos > -1 && this.pos < this.items.length) {
        const item = this.items[this.pos];
        this.items.splice(0, this.items.length);
        this.destroy();
        this.command(item);
        return true;
      }
    }
    return false;
  }

  createListItem(item: Item, cnt: number) { // override
    const li = document.createElement('li');
    if (cnt === this.pos) {
      li.classList.add('active');
    }
    li.innerText = '' + item; // TODO item to string and item formatting
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => {
      this.destroy();
      this.command(item);
    });
    return li;
  }

  refresh() {
    if (!this.wrapper) {
      this.wrapper = document.createElement('dialog');
      this.wrapper.classList.add(CSS_PREFIX + '__wrapper');
      document.body.appendChild(this.wrapper);

      this.list = document.createElement('ul');
      this.wrapper.appendChild(this.list);
    }

    document.body.removeEventListener('keydown', this.keyDownHandler, {
      capture: true,
    });

    if (!this.list) {
      return;
    }

    this.list.innerHTML = '';
    for (let cnt = 0; cnt < this.items.length; cnt++) {
      const item = this.items[cnt];
      this.list.appendChild(this.createListItem(item, cnt));
    }

    if (this.items.length > 0) {
      document.body.addEventListener('keydown', this.keyDownHandler, {
        capture: true,
      });
    }

    let visible = false;
    if (this.items.length === 0) {
      // this.wrapper.style.display = 'none';
    } else {
      visible = true;
      // this.wrapper.style.display = '';
    }

    const rect = this.props?.clientRect?.();
    if (rect?.height) {
      const left = rect.left;
      const bottom = rect.bottom;
      this.wrapper.style.left = left + 'px';
      this.wrapper.style.top = bottom + 'px';
    } else {
      visible = false;
    }

    if (visible) {
      if (!this.wrapper.open) {
        const el = document.activeElement;
        const previousFocus = el instanceof HTMLElement ? el : null;
        this.wrapper.show();
        requestAnimationFrame(() => {
          if (previousFocus && previousFocus.isConnected) {
            previousFocus.focus();
          }
        });
      }
    } else {
      if (this.wrapper.open) {
        this.wrapper.close();
      }
    }
  }
}
