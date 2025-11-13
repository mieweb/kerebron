import { CoreEditor } from '@kerebron/editor';
import {
  AutocompleteRenderer,
  SuggestionKeyDownProps,
  SuggestionProps,
} from './types.ts';

const CSS_PREFIX = 'kb-autocomplete';

export class DefaultRenderer<Item> implements AutocompleteRenderer {
  command: (props: any) => void;
  wrapper: HTMLElement | undefined;
  items: Array<Item> = [];
  pos: number = -1;

  constructor(private editor: CoreEditor) {
    this.command = () => {};
  }

  onStart(props: SuggestionProps<Item>) {
    this.command = props.command;
    if (this.wrapper) {
      this.wrapper.parentElement?.removeChild(this.wrapper);
    }
    const root = ('root' in this.editor.view)
      ? this.editor.view.root
      : document || document;

    this.wrapper = document.createElement('ul');
    this.wrapper.classList.add(CSS_PREFIX + '__wrapper');
    root.appendChild(this.wrapper);

    this.items.splice(0, this.items.length, ...props.items);
    this.recreateList(props);
  }

  onUpdate(props: SuggestionProps<Item>) {
    this.command = props.command;
    this.items.splice(0, this.items.length, ...props.items);
    this.recreateList(props);
  }

  onExit() {
    if (this.wrapper) {
      this.wrapper.parentNode?.removeChild(this.wrapper);
      this.wrapper = undefined;
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
        this.recreateList();
      }
      return true;
    }

    if (props.event.key === 'ArrowDown') {
      if (this.pos < this.items.length - 1) {
        this.pos++;
        this.recreateList();
      }
      return true;
    }

    if (props.event.key === 'Enter') {
      if (this.pos > -1 && this.pos < this.items.length) {
        this.command(this.items[this.pos]);
        this.items.splice(0, this.items.length);
        this.onExit();
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
      this.command(item);
    });
    return li;
  }

  recreateList(props?: SuggestionProps<Item>) {
    if (!this.wrapper) {
      return;
    }

    this.wrapper.innerHTML = '';
    for (let cnt = 0; cnt < this.items.length; cnt++) {
      const item = this.items[cnt];
      this.wrapper.appendChild(this.createListItem(item, cnt));
    }

    if (this.items.length === 0) {
      this.wrapper.style.display = 'none';
    } else {
      this.wrapper.style.display = '';
    }

    const rect = props?.clientRect?.();
    if (rect?.height) {
      const left = rect.left;
      const bottom = rect.bottom;
      this.wrapper.style.left = left + 'px';
      this.wrapper.style.top = bottom + 'px';
    }
  }
}
