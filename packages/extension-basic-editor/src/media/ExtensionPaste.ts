import { EditorState, Plugin, PluginKey, Transaction } from 'prosemirror-state';
import { DOMParser, Slice } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';

import { CommandFactories, CommandFactory } from '@kerebron/editor/commands';
import { type CoreEditor, Extension } from '@kerebron/editor';

import { elementFromString } from './ExtensionHtml.ts';
import { YamlService } from '@kerebron/editor/yaml';

type PasteRuleStep =
  | PasteRuleStepDefault
  | PasteRuleStepReplaceTag
  | PasteRuleStepMetaSet;

interface PasteRuleStepDefault {
  match: string | ((node: Node) => Node[]);
  result?: 'string' | 'nodes';
  op: 'remove' | 'replaceBody' | 'console.debug' | 'meta.set';
}

interface PasteRuleStepReplaceTag {
  match: string | ((node: Node) => Node[]);
  result?: 'string' | 'nodes';
  op: 'replaceTag';
  tag: string;
}

interface PasteRuleStepMetaSet {
  match: string | ((node: Node) => Node[]);
  result?: 'string' | 'nodes';
  op: 'meta.set';
  path: string;
}

export type PasteRule = HtmlPasteRule;

export interface HtmlPasteRule {
  match: string | ((node: Node) => boolean);
  steps: Array<PasteRuleStep>;
  replaceDocument?: boolean;
}

function getStringByXPath(xpath: string, element: HTMLElement): string {
  const result = element.ownerDocument.evaluate(
    xpath,
    element,
    null,
    XPathResult.STRING_TYPE,
    null,
  );

  return result.stringValue;
}

function getElementsByXPath(xpath: string, element: HTMLElement): Node[] {
  const result = element.ownerDocument.evaluate(
    xpath,
    element,
    null,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null,
  );

  const retVal = [];
  for (let i = 0; i < result.snapshotLength; i++) {
    const node = result.snapshotItem(i);
    if (!node) {
      continue;
    }
    retVal.push(node);
  }

  return retVal;
}

interface PasteMeta {
  getPasteRules?: (pasteRules: HtmlPasteRule[]) => void;
  setPasteRules?: HtmlPasteRule[];
  pasteHtml: {
    from: number;
    html: string;
  };
}

class PasteState {
  pasteRules: HtmlPasteRule[] = [];

  constructor(private editor: CoreEditor) {
  }

  handleCommands(pluginMeta: PasteMeta | undefined, transaction: Transaction) {
    if (!pluginMeta) {
      return false;
    }

    if (pluginMeta.getPasteRules) {
      pluginMeta.getPasteRules(this.pasteRules);
      return true;
    }

    if (pluginMeta.setPasteRules) {
      console.log('setPasteRules', pluginMeta.setPasteRules);
      this.pasteRules = pluginMeta.setPasteRules;
      return true;
    }

    if (pluginMeta.pasteHtml) {
      const { from, html } = pluginMeta.pasteHtml;

      let body = elementFromString(html);
      const editor = this.editor;

      let replaceDocument = false;

      const metaOps: any[] = [];
      const yaml = editor.ci.resolve('yaml') as YamlService;

      for (const rule of this.pasteRules) {
        if ('string' === typeof rule.match) {
          const matched = getElementsByXPath(rule.match, body);
          if (matched.length === 0) {
            continue;
          }
        } else {
          if (!rule.match(body)) {
            continue;
          }
        }

        for (const step of rule.steps) {
          let matched;
          if ('string' === typeof step.match) {
            switch (step.result || '') {
              case 'string':
                matched = getStringByXPath(step.match, body);
                break;
              default:
                matched = getElementsByXPath(step.match, body);
                break;
            }
          } else {
            matched = step.match(body);
          }

          console.log('step', matched, step);

          switch (step.op) {
            case 'remove':
              for (const node of matched) {
                node.parentNode?.removeChild(node);
              }
              break;
            case 'replaceTag':
              for (const node of matched) {
                const newNode = node.ownerDocument!.createElement(step.tag);
                (newNode as HTMLElement).innerHTML =
                  (node as HTMLElement).innerHTML;
                node.parentNode?.replaceChild(newNode, node);
              }
              break;
            case 'replaceBody':
              for (const node of matched) {
                body.innerHTML = '';
                body.appendChild(node);
              }
              break;
            case 'console.debug':
              console.debug(matched);
              break;
            case 'meta.set':
              metaOps.push({
                path: step.path,
                value: matched,
              });
              break;
          }
        }

        replaceDocument = !!rule.replaceDocument;
        break;
      }

      const parser = DOMParser.fromSchema(this.editor.schema);
      const node = parser.parse(body);

      setTimeout(async () => {
        const tr = this.editor.state.tr;

        if (replaceDocument) {
          tr.replaceWith(0, this.editor.state.doc.content.size, node);
        } else {
          tr.insert(from, node);
        }

        // TODO: CLEAR odt/md

        {
          const meta = await new Promise<Map<any, any>>((r) =>
            this.editor.chain().getMeta(r).run()
          ) || new Map();
          for (const op of metaOps) {
            yaml.setPathValue(meta, op.path, op.value);
          }
          tr.setDocAttribute('meta', meta);
        }

        this.editor.dispatchTransaction(tr);
      }, 0);

      return true;
    }

    return false;
  }
}

export const PastePluginKey = new PluginKey<PasteState>('paste');

export class ExtensionPaste extends Extension {
  name = 'paste';

  override getProseMirrorPlugins(): Plugin[] {
    const editor = this.editor;

    return [
      new Plugin<PasteState>({
        key: PastePluginKey,
        state: {
          init() {
            const prevState = PastePluginKey.getState(editor.state);
            if (prevState) { // preserve config after loadDocument
              return prevState;
            }
            return new PasteState(editor);
          },
          apply(transaction, nextPasteState: PasteState, prevState, state) {
            if (transaction.isGeneric) {
              return nextPasteState;
            }

            const pluginMeta: PasteMeta | undefined = transaction.getMeta(
              PastePluginKey,
            );

            if (nextPasteState.handleCommands(pluginMeta, transaction)) {
              return nextPasteState;
            }

            return nextPasteState;
          },
        },
        props: {
          handlePaste(view: EditorView, event: ClipboardEvent, slice: Slice) {
            const { clipboardData } = event;

            if (!clipboardData) {
              return false;
            }

            if (clipboardData.types.includes('text/html')) {
              const { from } = view.state.selection;
              const html = clipboardData.getData('text/html');
              event.preventDefault();

              const transaction = view.state.tr.setMeta(PastePluginKey, {
                pasteHtml: { from, html },
              });
              view.dispatch(transaction);

              return true;
            }

            const allFiles: File[] = [...clipboardData.items]
              .map((data) => data.getAsFile())
              .filter((file): file is File => !!file);

            const files = Array.from(event.clipboardData?.files || []);
            if (files.length === 1) {
              const file = files[0];
              if (editor.getMediaTypes().includes(file.type)) {
                file.bytes().then((bytes) => {
                  editor.loadDocument(file.type, bytes);
                });
                return true;
              }
            }
          },
          handleDrop(
            _view: EditorView,
            event: DragEvent,
            _slice: Slice,
            _moved: boolean,
          ) {
            const files = Array.from(event.dataTransfer?.files || []);
            if (files.length === 1) {
              const file = files[0];
              if (editor.getMediaTypes().includes(file.type)) {
                file.bytes().then((bytes) => {
                  editor.loadDocument(file.type, bytes);
                });
                return true;
              }
            }
          },
        },
      }),
    ];
  }

  override getCommandFactories(editor: CoreEditor): Partial<CommandFactories> {
    const getPasteRules: CommandFactory = (
      cb: (pasteRules: PasteRule[]) => void,
    ) => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;
        tr.setMeta(PastePluginKey, { getPasteRules: cb });

        if (dispatch) {
          dispatch(tr);
        }

        return true;
      };
    };

    const setPasteRules: CommandFactory = (pasteRules: PasteRule[]) => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;
        tr.setMeta(PastePluginKey, { setPasteRules: pasteRules });

        if (dispatch) {
          dispatch(tr);
        }

        return true;
      };
    };

    return {
      getPasteRules,
      setPasteRules,
    };
  }
}
