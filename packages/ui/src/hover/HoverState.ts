import { Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import { CoreEditor, TextRange } from '@kerebron/editor';
import { debounce } from '@kerebron/editor/utilities';

import { Ui } from '../Ui.ts';
import { getLocalElement } from '../utilities/dom.ts';
import { KerebronPopup } from '../popup/types.ts';

import { HoverMatch, HoverSource, HoverTrigger } from './types.ts';
import { getNodeRange, getOffsetWithinElement } from './utils.ts';
import { HoverPluginKey } from './HoverPlugin.ts';
import { getRuntimeUri } from '@kerebron/editor/uri';
import { ResolvedPos } from 'prosemirror-model';

let idGenerator = 1;

export interface HoverMeta {
  addHoverSource?: {
    hoverSource: HoverSource;
  };
  trigger?: HoverTrigger;
  setRequest?: HoverMatch & { source: HoverSource; trigger: HoverTrigger };
  setResponse?: HoverMatch & {
    id: number;
  };
  clearRequest?: boolean;
}

export class HoverState<I = any> {
  hoverSources: HoverSource[] = [];

  request?: {
    id: number;
    source: HoverSource;
    trigger: HoverTrigger;
    range: TextRange;
    text: string;
    meta: any;
  };

  popup?: KerebronPopup;

  response?: HoverMatch & {
    id: number;
  };

  navigationPending?: boolean;

  constructor(private editor: CoreEditor) {
    this.onMouseMove = debounce(this.onMouseMove.bind(this), 500);
    this.onMouseLeave = debounce(this.onMouseLeave.bind(this), 500);
    this.matchSource = debounce(this.matchSource.bind(this), 200);
    this.onKeyboardNav = debounce(this.onKeyboardNav.bind(this), 1000);
  }

  private matchSource(trigger: HoverTrigger): void {
    const sources: HoverSource[] = this.hoverSources;
    let matched: HoverMatch | undefined = undefined;

    for (const source of sources) {
      if (!source.match) {
        continue;
      }

      const match = source.match.apply(source, [trigger]);
      if (match) {
        matched = match;

        this.dispatchMeta({
          setRequest: {
            source: source,
            trigger,
            range: match.range,
            text: match.text,
            meta: match.meta,
          },
        });

        break;
      }
    }

    if (!matched) {
      this.dispatchMeta({ clearRequest: true });
    }

    return undefined;
  }

  onKeyboardNav($from: ResolvedPos) {
    const uri = getRuntimeUri($from.parent) || this.editor.config.uri;

    this.dispatchMeta({
      trigger: {
        mode: 'keyboard',
        node: $from.parent,
        pos: $from.pos,
        textOffset: $from.textOffset,
        uri,
      },
    });
  }

  onMouseLeave(view: EditorView, event: Event | undefined) {
    // this.dispatchMeta({
    //   clearRequest: true,
    // });
  }

  onMouseMove(view: EditorView, event: MouseEvent) {
    const coords = {
      left: event.clientX,
      top: event.clientY,
    };

    const domElement: Element | undefined = view.root.elementFromPoint(
      event.clientX,
      event.clientY,
    ) || undefined;

    if (!domElement) {
      return;
    }

    const codeBlockElement = getLocalElement(view.root, domElement);
    if (codeBlockElement) {
      const range = getNodeRange(event);
      if (range) {
        const textOffset = getOffsetWithinElement(codeBlockElement, range);
        const localPos = codeBlockElement.getLocalPos(textOffset);
        if (localPos) {
          const precisePos = localPos.pos;

          // avoid redundant updates
          if (
            this.response && this.response.range.from <= precisePos &&
            precisePos < this.response.range.to
          ) return;
          if (
            this.request && this.request.range.from <= precisePos &&
            precisePos < this.request.range.to
          ) return;

          const uri = getRuntimeUri(localPos.node);

          this.dispatchMeta({
            trigger: {
              mode: 'mouse',
              node: localPos.node,
              pos: localPos.pos,
              textOffset: localPos.textOffset,
              uri,
            },
          });
        }
        return;
      }
    }

    const result = view.posAtCoords(coords);

    if (!result) return;
    if (result.inside === -1) return;

    const pos = result.pos;
    const node = view.state.doc.nodeAt(pos) || undefined;

    // Handle nodeview for code_block
    if (!node) {
      this.dispatchMeta({
        clearRequest: true,
      });

      return;
    }

    const precisePos = result.pos;

    // avoid redundant updates
    if (
      this.response && this.response.range.from <= precisePos &&
      precisePos < this.response.range.to
    ) return;
    if (
      this.request && this.request.range.from <= precisePos &&
      precisePos < this.request.range.to
    ) return;

    this.dispatchMeta({
      trigger: {
        mode: 'mouse',
        pos: result.pos,
        textOffset: 0, // result.textOffset,
        node,
        uri: this.editor.config.uri,
      },
    });
  }

  handleCommands(pluginMeta: HoverMeta | undefined, transaction: Transaction) {
    if (!pluginMeta) {
      return false;
    }

    if (pluginMeta.addHoverSource) {
      this.hoverSources.push(pluginMeta.addHoverSource.hoverSource);
      return true;
    }

    if (pluginMeta.trigger) {
      if (this.response) {
        const pos = pluginMeta.trigger.pos;
        if (this.response.range.from <= pos && pos < this.response.range.to) {
          return true;
        }
      }

      this.matchSource(pluginMeta.trigger);
      return true;
    }

    if (pluginMeta?.setRequest) {
      const id = idGenerator++;

      this.request = {
        id,
        trigger: pluginMeta.setRequest.trigger,
        source: pluginMeta.setRequest.source,
        range: pluginMeta.setRequest.range,
        text: pluginMeta.setRequest.text,
        meta: pluginMeta.setRequest.meta,
      };
      this.response = undefined;

      const request = this.request;

      const go = async () => {
        try {
          const ui: Ui = this.editor.ci.resolve('ui')!;
          const createPopup = () => {
            this.popup?.remove();
            this.popup = undefined;
            const popup = ui.createPopup({
              anchorId: `--hover${id}`,
              layer: 'overlayer',
              group: 'hover',
            });
            this.popup = popup;

            return popup;
          };

          this.popup?.remove();
          this.popup = undefined;

          const match: HoverMatch = {
            range: request.range,
            text: request.text,
            meta: request.meta,
          };

          const response = await request.source.processRequest(
            request.trigger,
            match,
            createPopup,
          );
          if (!response) {
            this.dispatchMeta({ clearRequest: true });
            return;
          }

          this.dispatchMeta({
            setResponse: {
              ...response,
              id,
            },
          });
        } catch (err) {
          console.error(err);
          this.dispatchMeta({
            clearRequest: true,
          });
        }
      };
      go();

      return true;
    }

    if (pluginMeta.setResponse) {
      this.response = {
        ...pluginMeta.setResponse,
      };
      return;
    }

    if (pluginMeta.clearRequest) {
      this.clearRequest();
      return true;
    }

    return false;
  }

  dispatchMeta(meta: HoverMeta) {
    const tr = this.editor.state.tr;
    tr.setMeta(HoverPluginKey, meta);
    this.editor.dispatchTransaction(tr);
  }

  clearRequest() {
    this.popup?.remove();
    this.popup = undefined;
    this.request = undefined;
    this.response = undefined;
  }

  destroy() {
    this.clearRequest();
  }
}
