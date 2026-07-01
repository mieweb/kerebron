import { CoreEditor } from '@kerebron/editor';
import {
  AutocompleteRenderer,
  SuggestionKeyDownProps,
  SuggestionProps,
} from './types.ts';
import { anchorElement, OverLayer } from '../overlayer/mod.ts';

const CSS_PREFIX = 'kb-autocomplete';

export class DefaultRenderer<Item> extends EventTarget
  implements AutocompleteRenderer {
  command: (props: any) => void;
  wrapper: HTMLElement | undefined;
  list: HTMLElement | undefined;
  items: Array<Item> = [];
  pos: number = -1;
  props: SuggestionProps<Item, any> | undefined;
  readonly keyDownHandler: (this: HTMLElement, ev: KeyboardEvent) => any;
  overlayer: OverLayer;
  anchor?: string;

  constructor(private editor: CoreEditor) {
    super();

    this.overlayer = this.editor.ci.resolve('overlayer');

    this.command = () => {};

    this.keyDownHandler = (event) => {
      if (this.onKeyDown({ event })) {
        event.stopPropagation();
        event.preventDefault();
      }
    };
  }

  setCommand(command: (props: any) => void) {
    this.command = command;
    this.refresh();
  }

  setResponse() {
    this.refresh();
  }

  onUpdate(props: SuggestionProps<Item>) {
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
      this.wrapper = this.overlayer.createElement('div');
      this.wrapper.classList.add(CSS_PREFIX + '__wrapper');

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

    if (this.anchor) {
      anchorElement(this.wrapper, this.anchor, {
        container: this.editor.config.element,
      });
    } else {
      visible = false;
    }

    //   if (visible) {
    //     if (!this.wrapper.matches(':popover-open')) {
    //       const el = document.activeElement;
    //       const previousFocus = el instanceof HTMLElement ? el : null;
    //       this.wrapper.showPopover();
    //       requestAnimationFrame(() => {
    //         if (previousFocus && previousFocus.isConnected) {
    //           previousFocus.focus();
    //         }
    //       });
    //     }
    //   } else {
    //     if (this.wrapper.matches(':popover-open')) {
    //       this.wrapper.hidePopover();
    //     }
    //   }
  }

  setAnchorSelector(anchor: string): void {
    this.anchor = anchor;
    this.refresh();
  }
}
