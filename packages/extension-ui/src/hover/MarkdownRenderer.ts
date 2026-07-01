import { CoreEditor } from '@kerebron/editor';
import { anchorElement, type OverLayer } from '../overlayer/mod.ts';

const CSS_PREFIX = 'kb-hover';

export interface AnchorOpts {
  above?: boolean;
}

export class MarkdownRenderer extends EventTarget {
  overlayer: OverLayer;
  wrapper: HTMLElement | undefined;
  anchor?: { selector: string; opts: AnchorOpts };
  text: string | undefined;

  constructor(private editor: CoreEditor) {
    super();

    this.overlayer = this.editor.ci.resolve('overlayer');
  }

  setResponse({ text }: { text: string | undefined }) {
    this.text = text;
    this.refresh();
  }

  refresh() {
    if (!this.text) {
      if (this.wrapper) {
        this.wrapper.style.display = 'none';
      }
      return;
    }

    console.log('MarkdownRenderer this.wrapper', this.wrapper);

    if (!this.wrapper) {
      this.wrapper = this.overlayer.createElement('div');
      this.wrapper.classList.add(CSS_PREFIX + '__wrapper');
    }

    this.wrapper.innerText = this.text;
    this.wrapper.style.display = '';

    if (this.anchor) {
      console.log('anchorElement', this.anchor.selector);
      anchorElement(this.wrapper, this.anchor.selector, {
        container: this.editor.config.element,
        above: this.anchor.opts.above,
      });
    }
  }

  destroy() {
    if (this.wrapper) {
      this.wrapper.parentNode?.removeChild(this.wrapper);
      this.wrapper.dispatchEvent(new CustomEvent('removed'));
      this.wrapper = undefined;
      this.dispatchEvent(new Event('close'));
    }
  }

  setAnchorSelector(selector: string, opts: AnchorOpts): void {
    console.log('setAnchorSelector', selector);
    this.anchor = { selector, opts };
    this.refresh();
  }
}
