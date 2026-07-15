import { Node as PmNode } from 'prosemirror-model';
import { Plugin, PluginKey, Selection, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';

import { type CoreEditor, TextRange } from '@kerebron/editor';
import { debounce } from '@kerebron/editor/utilities';

import { HoverConfig, HoverMatch, HoverSource, HoverTrigger } from './types.ts';
import { MarkdownRenderer } from './MarkdownRenderer.ts';

export const HoverPluginKey = new PluginKey<HoverState>(
  'hover',
);

interface HoverMeta {
  addHoverSource?: {
    hoverSource: HoverSource;
  };
  trigger?: HoverTrigger;
  setRequest?: HoverMatch;
  setResponse?: {
    id: number;
    text: string;
  };
  clearRequest?: boolean;
}

class HoverState {
  idGenerator = 1;

  hoverSources: HoverSource[] = [];

  request?: {
    decorationId: string;
    id: number;
    range: TextRange;
    trigger: HoverTrigger;
    uri?: string;
    source: HoverSource;
    renderer: MarkdownRenderer;
  };

  response?: {
    id: number;
    text: string;
  };

  constructor(private editor: CoreEditor) {
    this.onMouseMove = debounce(this.onMouseMove.bind(this), 200);
    this.onMouseLeave = debounce(this.onMouseLeave.bind(this), 200);
    this.matchSource = debounce(this.matchSource.bind(this), 200);
  }

  clearActive() {
    if (this.request) {
      this.request.renderer.destroy();
      this.request = undefined;
    }
    this.response = undefined;
  }

  private matchSource(trigger: HoverTrigger): void {
    const sources: HoverSource[] = this.hoverSources;
    let matched: HoverMatch | undefined = undefined;
    const parentNode = trigger.node;

    // if (parentNode && !parentNode.isTextblock && !parentNode.isText) { //
    //   console.trace('!parentNode', trigger);
    //   return;
    // }

    for (const source of sources) {
      if (!source.match) {
        continue;
      }

      const match = source.match(trigger);
      if (match) {
        matched = match;

        this.handleSource(match, trigger);
        break;
      }
    }

    if (!matched) {
      this.dispatchMeta({ clearRequest: true });
    }

    return undefined;
  }

  handleSource(match: HoverMatch, trigger: HoverTrigger) {
    this.dispatchMeta({
      setRequest: {
        source: match.source,
        range: match.range,
        text: match.text,
        uri: match.uri,
        trigger,
      },
    });
  }

  onMouseLeave(view: EditorView, event: Event | undefined) {
    this.dispatchMeta({
      clearRequest: true,
    });
  }

  onMouseMove(view: EditorView, event: MouseEvent) {
    const coords = {
      left: event.clientX,
      top: event.clientY,
    };

    const result = view.posAtCoords(coords);

    if (!result) return;
    if (result.inside === -1) return;

    const pos = result.pos;
    const node = view.state.doc.nodeAt(pos) || undefined;

    if (!node) {
      console.error('NO NODE at', pos);
    }

    // Handle nodeview for code_block
    const dom = view.nodeDOM(pos);
    if (dom instanceof HTMLElement) {
      const editorElement = dom.querySelector('[data-uri]');
      const uri =
        (editorElement ? editorElement.getAttribute('data-uri') : undefined) ||
        undefined;

      if (uri && editorElement) {
        const range = getNodeRange(event);
        if (range) {
          const offset = getOffsetWithinElement(editorElement, range);

          result.inside = offset;
          if (result.inside === -1) return;

          this.dispatchMeta({
            trigger: {
              pos: result.pos,
              inside: result.inside,
              node,
              uri,
            },
          });
        }
        return;
      }
    }

    if (!node) {
      return;
    }

    // avoid redundant updates
    // if (this.request?.range.from === result.range.from && this.request?.range.to === result.inside) return;

    this.dispatchMeta({
      trigger: {
        pos: result.pos,
        inside: result.inside,
        node,
        uri: undefined,
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
      this.matchSource(pluginMeta?.trigger);
      return true;
    }

    if (pluginMeta?.setRequest) {
      const id = this.idGenerator++;
      const decorationId = `id_${Math.floor(Math.random() * 0xffffffff)}`;

      let renderer = this.request?.renderer;
      if (this.request?.source !== pluginMeta.setRequest.source) {
        if (renderer) {
          renderer.destroy();
          renderer = undefined;
        }
      }
      if (!renderer) {
        renderer = new MarkdownRenderer(this.editor);
        renderer.addEventListener('close', () => {
          this.dispatchMeta({
            clearRequest: true,
          });
        });
      }

      renderer.setAnchorSelector(`[data-decoration-id="${decorationId}"]`, {
        above: true,
      });

      this.request = {
        id,
        decorationId,
        range: pluginMeta.setRequest.range,
        uri: pluginMeta.setRequest.uri,
        source: pluginMeta.setRequest.source,
        trigger: pluginMeta.setRequest.trigger,
        renderer,
      };

      const request = this.request;

      const go = async () => {
        const item = await request.source.getItem(
          request.range,
          request.trigger,
        );
        if (!item) {
          return;
        }

        this.dispatchMeta({
          setResponse: {
            id,
            text: item.text,
          },
        });
      };
      go();

      return true;
    }

    if (pluginMeta?.setResponse && this.request) {
      this.response = {
        id: pluginMeta?.setResponse.id,
        text: pluginMeta?.setResponse.text,
      };

      this.request?.renderer.setResponse({ text: this.response.text });

      return true;
    }

    if (pluginMeta.clearRequest) {
      this.clearRequest();
      return true;
    }

    return false;
  }

  clearRequest() {
    if (this.request) {
      this.request.renderer.destroy();
      this.request = undefined;
    }
    this.response = undefined;
  }

  dispatchMeta(meta: HoverMeta) {
    const tr = this.editor.state.tr;
    tr.setMeta(HoverPluginKey, meta);
    this.editor.dispatchTransaction(tr);
  }
}

function getNodeRange(
  { clientX, clientY }: { clientX: number; clientY: number },
) {
  let range;

  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(clientX, clientY);
    if (!pos) return;
    range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
  } else if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(clientX, clientY);
  }

  return range;
}

function getOffsetWithinElement(element: Node, range: Range): number {
  const container = range.startContainer;
  const offsetInNode = range.startOffset;

  if (container === element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const firstText = walker.nextNode();
    if (!firstText) return offsetInNode;
    let total = 0;
    let node: Text | null = firstText as Text;
    while (node) {
      if (node === container) return total + offsetInNode;
      total += node.nodeValue?.length ?? 0;
      node = walker.nextNode() as Text | null;
    }
    return total;
  }

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let total = 0;
  let textNode = walker.nextNode() as Text | null;
  while (textNode) {
    if (textNode === container) {
      return total + offsetInNode;
    }
    total += textNode.nodeValue?.length ?? 0;
    textNode = walker.nextNode() as Text | null;
  }
  return -1;
}

// function matchSource(selection: Selection, sources: HoverSource[]) {
//   let matched: MatchedSource | undefined = undefined;
//   const parentNode = selection.$anchor.parent;

//   for (const source of sources) {
//     if (!source.match) {
//       continue;
//     }

//     const trigger: HoverTrigger = {
//       pos: 0,
//       inside: 0,
//       node: parentNode,
//       uri: parentNode.attrs.uri
//     };

//     const match = source.match(trigger);
//     if (match) {
//       matched = match;
//       return matched;
//     }
//   }
//   return undefined;
// }

export class HoverPlugin<Item, TSelected> extends Plugin<HoverState> {
  constructor(config: HoverConfig, editor: CoreEditor) {
    super({
      key: HoverPluginKey,
      state: {
        init() {
          const prevState = HoverPluginKey.getState(editor.state);
          if (prevState) { // preserve config after loadDocument
            return prevState;
          }
          return new HoverState(editor);
        },

        apply(transaction, nextHoverState: HoverState, prevState, state) {
          if (transaction.docChanged) {
            nextHoverState.dispatchMeta({ clearRequest: true });
          }

          if (transaction.isGeneric) {
            return nextHoverState;
          }

          const pluginMeta: HoverMeta | undefined = transaction.getMeta(
            HoverPluginKey,
          );

          if (nextHoverState.handleCommands(pluginMeta, transaction)) {
            return nextHoverState;
          }

          return nextHoverState;
        },
      },

      view() {
        return {
          update: async (view, prevState) => {
            return;
          },

          destroy: () => {
            const pluginState = HoverPluginKey.getState(editor.state);
            if (!pluginState) {
              return;
            }

            if (pluginState.request) {
              pluginState.request.renderer.destroy();
            }
          },
        };
      },

      props: {
        handleDOMEvents: {
          mousemove: (view, event) => {
            const pluginState = HoverPluginKey.getState(editor.state);
            if (!pluginState) {
              return;
            }
            pluginState.onMouseMove(view, event);
            return;
          },
          mouseleave: (view, event) => {
            const pluginState = HoverPluginKey.getState(editor.state);
            if (!pluginState) {
              return;
            }
            pluginState.onMouseLeave(view, event);
            return;
          },
        },

        decorations(state) {
          const { request } = this.getState(state) || {};

          if (!request) {
            return null;
          }

          const attrs = {
            class: config.decorationClass || 'kb-hover--decor',
            'data-decoration-id': request.decorationId,
          };

          if (request.range.from === request.range.to) {
            return DecorationSet.create(state.doc, [
              Decoration.widget(request.range.from, () => {
                const widgetNode = document.createElement('span');
                widgetNode.className = attrs.class;
                for (const [k, v] of Object.entries(attrs)) {
                  widgetNode.setAttribute(k, v);
                }
                return widgetNode;
              }, attrs),
            ]);
          } else {
            return DecorationSet.create(state.doc, [
              Decoration.inline(request.range.from, request.range.to, {
                ...attrs,
              }),
            ]);
          }
        },
      },
    });
  }
}
