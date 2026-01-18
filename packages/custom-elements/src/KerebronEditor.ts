import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';

import mainCssText from '@kerebron/editor/assets/index.css?inline';
import kitCssText from '@kerebron/editor-kits/assets/AdvancedEditorKit.css?inline';

export default class KerebronEditor extends HTMLElement {
  static tagName = 'kerebron-editor';
  editor: CoreEditor | undefined;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    // https://github.com/vitejs/vite/issues/17700
    // import mainCss from "@kerebron/editor/assets/index.css" with { type: 'css' };
    // import kitCss from "@kerebron/editor-kits/assets/AdvancedEditorKit.css" with { type: 'css' };
    // shadow.adoptedStyleSheets = [mainCss, kitCss];
  }

  connectedCallback() {
    if (this.editor) {
      return;
    }

    for (const cssText of [mainCssText, kitCssText]) {
      const style = document.createElement('style');
      style.textContent = cssText;
      this.shadowRoot.appendChild(style);
    }

    const wrapper = document.createElement('div');
    wrapper.setAttribute('class', 'kb-component');
    this.shadowRoot.appendChild(wrapper);

    this.editor = CoreEditor.create({
      cdnUrl: this.getAttribute('cdn-url') || undefined,
      readOnly: this.hasAttribute('readonly') ? true : false,
      element: wrapper,
      editorKits: [
        new AdvancedEditorKit(),
      ],
    });

    this.editor.addEventListener('change', (event) => {
      this.dispatchEvent(event);
    });

    if (this.getAttribute('media-type')) {
      console.log(
        'mmdmdmdmdmdmdmmdddd',
        this.getAttribute('media-type'),
        this.innerHTML,
      );
      this.editor.loadDocument(
        this.getAttribute('media-type'),
        new TextEncoder().encode(this.innerHTML),
      );
    } else {
      this.editor.loadDocument(
        'text/html',
        new TextEncoder().encode(this.innerHTML),
      );
    }
  }

  loadDocument(...args: Parameters<typeof this.editor.loadDocument>) {
    return this.editor?.loadDocument(...args);
  }

  saveDocument(...args: Parameters<typeof this.editor.saveDocument>) {
    return this.editor?.saveDocument(...args);
  }

  disconnectedCallback() {
    console.log('Custom element removed from page.');
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
