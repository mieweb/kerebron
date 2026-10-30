import { DOMOutputSpec } from 'prosemirror-model';

import { CoreEditor } from '@kerebron/editor';
import { anchorElement, OverLayer } from '@kerebron/ui/OverLayer';
import { KerebronPopup, PopupOptions } from './popup/types.ts';
import {
  findClosestElement,
  findFocusableChild,
  getCaretPos,
} from './popup/utils.ts';
import { bindLinks } from './events/linkBindings.ts';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor/ExtensionBasicEditor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionTables } from '@kerebron/extension-tables';

export class Ui {
  topLayer?: OverLayer;
  overLayer?: OverLayer;
  topLevelPopups: Set<KerebronPopup> = new Set();
  allPopups: Set<KerebronPopup> = new Set();
  mainPopup?: HTMLElement;

  constructor(private readonly editor: CoreEditor) {
    const topLayerElement = document.createElement('div');
    topLayerElement.classList.add('kb--top-layer');
    this.topLayer = new OverLayer(topLayerElement);
    this.editor.ci.register('toplayer', this.topLayer);

    this.overLayer = new OverLayer();
    this.editor.ci.register('overlayer', this.overLayer);

    this.editor.addEventListener('ready', () => {
      if (this.editor.wrapperElement) {
        this.editor.wrapperElement.appendChild(topLayerElement);
      }
      this.bindKeys();
      this.bindMouse();
    });
  }

  bindKeys() {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        // TODO popup / menu
        this.mainPopup?.remove();
        return;
      }

      let keyHandledByPopup = false;
      this.walkPopups((popup) => {
        if (popup.keydownHandler) {
          if (popup.keydownHandler(event)) {
            keyHandledByPopup = true;
            return true;
          }
        }
      });

      if (keyHandledByPopup) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (
        this.editor.editorElement &&
        document.activeElement === this.editor.editorElement
      ) {
        if (this.topLevelPopups.size > 0) {
          if (event.key === 'ArrowUp') {
            const pos = getCaretPos(this.editor.editorElement);
            if (pos) {
              const closest = findClosestElement(
                Array.from(this.topLevelPopups),
                pos,
                'above',
              );
              if (closest) {
                const child = findFocusableChild(closest, 'last');
                if (child) {
                  event.preventDefault();
                  event.stopPropagation();
                  child.focus();
                  return;
                }
              }
            }
          }
          if (event.key === 'ArrowDown') {
            const pos = getCaretPos(this.editor.editorElement);
            if (pos) {
              const closest = findClosestElement(
                Array.from(this.topLevelPopups),
                pos,
                'below',
              );
              if (closest) {
                const child = findFocusableChild(closest, 'first');
                if (child) {
                  event.preventDefault();
                  event.stopPropagation();
                  child.focus();
                  return;
                }
              }
            }
          }
        }
      }
    }, { capture: true });
  }

  bindMouse() {
    if (!this.editor.editorElement) {
      return;
    }
    this.editor.editorElement.addEventListener('focus', (event: FocusEvent) => {
      event.preventDefault();
      event.stopPropagation();
      this.mainPopup?.remove();
    });
  }

  clearPopups() {
    for (const popup of this.topLevelPopups) {
      popup.remove();
    }
  }

  createPopup(options: PopupOptions): KerebronPopup {
    const layer =
      (options.layer === 'toplayer' ? this.topLayer : this.overLayer)!;

    let popup: KerebronPopup;
    let backdropElement: HTMLDivElement | undefined;
    if (options.backdrop) {
      popup = document.createElement('div') as HTMLElement as KerebronPopup;
      backdropElement = layer.createElement('div');
      if (backdropElement) {
        backdropElement.classList.add('kb-backdrop');
        backdropElement.appendChild(popup);
      }
    } else {
      popup = layer.createElement('div');
    }
    popup.classList.add('kb-popup');

    if (options.id) {
      popup.id = options.id;
    }
    if (options.className) {
      popup.classList.add(options.className);
    }
    if (options.anchorId === 'center') {
      anchorElement(popup, layer.centerElement.dataset.anchor!);
    } else if (options.anchorId) {
      anchorElement(popup, options.anchorId);
    }

    this.allPopups.add(popup);
    if (options.anscestor) {
      options.anscestor.addDescendant(popup);
    } else {
      this.topLevelPopups.add(popup);

      if (!options.group) {
        if (this.mainPopup) {
          this.mainPopup.remove();
        }
        this.mainPopup = popup;
      }

      popup.addEventListener('removed', () => {
        if (backdropElement) {
          backdropElement.remove();
        }
        this.topLevelPopups.delete(popup);
        this.allPopups.delete(popup);
        if (this.mainPopup === popup) {
          this.mainPopup = undefined;
        }
      });
    }

    Object.defineProperty(popup, 'setAnchorId', {
      value: function (this: HTMLElement, anchorId: string) {
        anchorElement(popup, anchorId);
      },
      configurable: true,
    });

    Object.defineProperty(popup, 'descendants', {
      value: [],
      writable: true,
      enumerable: true,
      configurable: true,
    });

    Object.defineProperty(popup, 'addDescendant', {
      value: function (this: HTMLElement, descendant: HTMLElement) {
        if ('descendants' in this && Array.isArray(this.descendants)) {
          this.descendants.push(descendant);
        }
      },
      configurable: true,
    });

    const observer = new MutationObserver((mutations) => {
      if (!popup.isConnected) {
        observer.disconnect();
        if ('descendants' in popup && Array.isArray(popup.descendants)) {
          for (const descendant of popup.descendants) {
            descendant.remove();
          }
        }
        popup.dispatchEvent(new CustomEvent('removed'));
      }
    });

    if (popup.parentElement) {
      observer.observe(popup.parentElement, {
        childList: true,
      });
    }

    bindLinks(popup);

    return popup;
  }

  async setPopupContent(popup: HTMLElement, spec: DOMOutputSpec) {
    const contentElement = await this.toDOMElement(spec) as HTMLElement;
    popup.innerHTML = '';
    popup.appendChild(contentElement);
  }

  walkPopups(cbk: (popup: KerebronPopup) => boolean | void) {
    for (const popup of this.allPopups) {
      if (cbk(popup)) {
        break;
      }
    }
  }

  async toDOMElement(spec: DOMOutputSpec | string): Promise<Node> {
    if (typeof spec === 'string') {
      if (spec.startsWith('&#')) {
        const match = spec.match(/^&#(?:x([0-9a-f]+)|([0-9]+));?$/i);
        if (match) {
          const codePoint = parseInt(match[1] || match[2], match[1] ? 16 : 10);
          return document.createTextNode(
            String.fromCodePoint(codePoint),
          );
        }
      }
      return document.createTextNode(spec);
    }

    if (spec instanceof Element) {
      return spec;
    }

    if (!Array.isArray(spec)) {
      throw new Error('Invalid DOM spec');
    }

    const [tag, maybeAttrs, ...children] = spec;

    const hasAttrs = maybeAttrs &&
      typeof maybeAttrs === 'object' &&
      !Array.isArray(maybeAttrs);

    const attrs = hasAttrs ? maybeAttrs : {};
    const childSpecs = hasAttrs ? children : [maybeAttrs, ...children];

    if (attrs['data-anchor']) {
      // TODO make it dynamic CSS class when available (see ui.css)
      let style = attrs['style'] || '';
      if (style) style += '; ';
      style += `anchor-name: ${attrs['data-anchor']};`;
      attrs['style'] = style;
    }

    try {
      if (
        tag === 'markdown' && childSpecs.length === 1 &&
        'string' === typeof childSpecs[0]
      ) {
        const mdConverter = CoreEditor.create({
          assetLoad: this.editor.config.assetLoad,
          editorKits: [
            {
              getExtensions() {
                return [
                  new ExtensionBasicEditor(),
                  new ExtensionMarkdown(),
                  new ExtensionTables(),
                ];
              },
            },
          ],
        });

        await mdConverter.loadDocumentText('text/markdown', childSpecs[0]);
        const html = new TextDecoder().decode(
          await mdConverter.saveDocument('text/html'),
        );

        console.log('convnnvnvnvv', childSpecs[0], html);

        const el = document.createElement('pre');
        el.innerHTML = html;

        for (const [name, value] of Object.entries(attrs)) {
          if (value != null) {
            el.setAttribute(name, String(value));
          }
        }

        return el;
      }

      const el = document.createElement(tag);

      for (const [name, value] of Object.entries(attrs)) {
        if (value != null) {
          el.setAttribute(name, String(value));
        }
      }

      for (const child of childSpecs) {
        if (child == null) continue;
        el.appendChild(await this.toDOMElement(child));
      }

      return el;
    } catch (err: any) {
      if (
        'message' in err && err.message.indexOf('Invalid element name') > -1
      ) {
        console.error('Error with tag:', tag);
      }
      throw err;
    }
  }
}
