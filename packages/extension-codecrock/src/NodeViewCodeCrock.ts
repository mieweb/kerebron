import { Node as PmNode } from 'prosemirror-model';
import { Selection } from 'prosemirror-state';
import {
  Decoration,
  DecorationSource,
  EditorView,
  NodeView,
  NodeViewConstructor,
} from 'prosemirror-view';
import { Diagnostic } from 'vscode-languageserver-protocol';

import { CoreEditor, RawTextResult } from '@kerebron/editor';
import { PositionMapper } from '@kerebron/extension-markdown/PositionMapper';
import { toRawTextResult } from '@kerebron/editor/utilities';

import { CodeCrock, debounce, Position } from './CodeCrock.ts';
import { computeChange, forwardSelection, valueChanged } from './utils.ts';
import { TreeSitterHighlighter } from './TreeSitterHighlighter.ts';
import { DecorationInline, Decorator } from './Decorator.ts';
import {
  initLineNumbers,
  lineNumberOptions,
  refreshNumbers,
} from './codeCrockLineNumbers.ts';
import { NodeCodeCrockConfig } from './NodeCodeCrock.ts';
import { DomOffset } from './DomOffset.ts';

function replaceExt(uri: string, lang: string) {
  switch (lang) {
    case 'markdown':
      lang = 'md';
      break;
    case 'mermaid':
      lang = 'mmd';
      break;
    case 'javascript':
      lang = 'js';
      break;
    case 'typescript':
      lang = 'ts';
      break;
  }

  const parts = uri.split('.');
  parts.pop();
  parts.push(lang);
  return parts.join('.');
}

export class NodeViewCodeCrock implements NodeView {
  private node: PmNode;
  private readonly view: EditorView;
  private readonly getPos: () => number | undefined;

  dom: HTMLDivElement;
  codeCrock: CodeCrock;
  updating: boolean;
  element: HTMLDivElement;
  highlighter: TreeSitterHighlighter;
  decorator: Decorator;
  languageDropDown: HTMLSelectElement;
  lineNumbers: HTMLElement;

  lang: string = 'plaintext';
  uri: string = 'file:///' + Math.random() + '.txt';
  diagListener: (event: Event) => void;

  constructor(
    private editor: CoreEditor,
    private config: NodeCodeCrockConfig,
    ...args: Parameters<NodeViewConstructor>
  ) {
    this.node = args[0];
    this.view = args[1];
    this.getPos = args[2];

    this.updating = false;
    const dom = document.createElement('div');
    this.dom = dom;
    dom.className = 'codecrock-root';

    this.languageDropDown = this.addLanguageDropDown();

    const root = (editor.view && 'root' in editor.view)
      ? editor.view.root
      : document || document;

    this.element = document.createElement('div');
    this.element.classList.add('codecrock');

    this.codeCrock = new CodeCrock(
      this.element,
      (element) => this.highlight(element),
      {
        tab: '  ',
        indentOn: new RegExp('^(?!)'),
        moveToNewLine: new RegExp('^(?!)'),
        history: false,
        readOnly: this.config.readOnly,
      },
    );

    const blur = (dir: 1 | -1) => {
      this.view.focus();
      const pos = this.getPos();
      if (typeof pos === 'undefined') {
        return false;
      }
      // const node = this.view.state.doc.nodeAt(pos);
      // if (!node) return false;

      const targetPos = pos + (dir < 0 ? 0 : this.node.nodeSize);
      const selection = Selection.near(
        this.view.state.doc.resolve(targetPos),
        dir,
      );

      this.view.dispatch(
        this.view.state.tr.setSelection(selection).scrollIntoView(),
      );
      this.view.focus();
      editor.chain().ArrowDown().run();

      // if (!editor.chain().exitCode().run()) {
      //   return false;
      // }
      // this.view.focus();
      return true;
    };

    this.codeCrock.addEventListener('blur-previous', () => {
      blur(-1);
    });
    this.codeCrock.addEventListener('blur-next', () => {
      blur(1);
    });
    this.codeCrock.addEventListener('prepend-empty-line', () => {
      const pos = this.getPos();
      if (typeof pos === 'undefined') {
        return false;
      }
      editor.chain().replaceRangeText({ from: pos, to: pos }, '').run();
    });
    this.codeCrock.addEventListener('append-empty-line', () => {
      const pos = this.getPos();
      if (typeof pos === 'undefined') {
        return false;
      }
      editor.chain().replaceRangeText({
        from: pos + this.node.nodeSize,
        to: pos + this.node.nodeSize,
      }, '').run();
    });

    this.codeCrock.onUpdate(() => {
      if (!this.updating) {
        const textUpdate = this.codeCrock.toString();
        valueChanged(textUpdate, this.node, this.getPos, this.view);
        if (document.activeElement === this.element) {
          forwardSelection(this.codeCrock, this.view, this.getPos);
        }
      }

      const tr = this.view.state.tr;
      tr.setMeta('workspace', {
        operation: 'modifyFile',
        node: this.node,
        pos: this.getPos(),
        lang: this.lang,
        uri: this.uri,
      });
      this.view.dispatch(tr);
    });

    this.highlighter = new TreeSitterHighlighter();
    this.highlighter.assetLoad = this.editor.config.assetLoad;
    this.decorator = new Decorator();

    dom.append(this.element);

    this.lineNumbers = initLineNumbers(this.element, lineNumberOptions);

    this.source = {
      ui: this.editor.ui,
      getMappedContent: async () => {
        const editor = this.editor;
        const result: RawTextResult = toRawTextResult(
          this.codeCrock.toString(),
          0,
        );
        const mapper = new PositionMapper(editor, result.rawTextMap);
        return {
          ...result,
          mapper,
        };
      },
    };

    let lastDiag = 0;
    this.diagListener = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      console.log('diagListener', detail.params.uri);

      if (detail.params.uri !== this.uri) {
        return;
      }

      event.preventDefault();

      lastDiag = +Date();

      const client = this.extensionLsp?.getClient(this.lang);
      if (client) {
        const file = client.workspace.getFile(this.uri);
        if (file) {
          const { mapper } = file;
          console.debug({
            diagnostics: detail.params.diagnostics,
            mapper,
          });

          const diagnostics: Diagnostic[] = detail.params.diagnostics;

          const decors: DecorationInline[] = [];

          for (const diag of diagnostics) {
            const startIndex = mapper.fromLineChar(
              diag.range.start.line,
              diag.range.start.character,
            );
            const endIndex = mapper.fromLineChar(
              diag.range.end.line,
              diag.range.end.character,
            );

            decors.push({
              startIndex,
              endIndex,
              attrs: {
                class: 'kb-lsp__error',
                title: diag.message || '',
              },
            });
          }

          this.decorator.decorationGroups.innerDiag = decors;
          console.log('decors', decors);
          this.highlight(this.element);
        }
      }
    };

    this.handleMove = debounce(this.handleMove.bind(this), 500);
    this.dom.addEventListener('mousemove', this.handleMove);
  }

  addLanguageDropDown() {
    const select = document.createElement('select');
    select.classList.add('codecrock-select');
    for (const lang of [''].concat(this.config.languageWhitelist || [])) {
      const option = document.createElement('option');
      option.value = lang;
      option.innerText = lang;
      select.appendChild(option);
    }
    this.dom.appendChild(select);
    select.addEventListener('change', async () => {
      const lang = select.value;
      const pos = this.getPos();
      if (pos) {
        this.view.dispatch(
          this.view.state.tr.setNodeMarkup(pos, undefined, {
            ...this.node.attrs,
            lang,
          }),
        );
      }
      await this.setLang(lang);
    });
    return select;
  }

  async setLang(lang: string) {
    this.languageDropDown.value = lang || '';
    await this.highlighter.init(lang);
    this.highlight(this.element);
    this.lang = lang;

    this.uri = replaceExt(this.uri, lang);
    this.element.setAttribute('data-uri', this.uri);

    const tr = this.view.state.tr;
    tr.setMeta('workspace', {
      operation: 'openFile',
      node: this.node,
      pos: this.getPos(),
      uri: this.uri,
      lang,
    });
    this.view.dispatch(tr);
  }

  async init() {
    this.codeCrock.updateCode(this.node.textContent, false);
    if (this.node.attrs.lang) {
      await this.setLang(this.node.attrs.lang);
    }
  }

  setSelection(anchor: number, head: number) {
    this.element.focus();
    this.updating = true;

    const pos = this.getPos();
    if (typeof pos !== 'undefined') {
      anchor -= pos;
      head -= pos;

      const posJar: Position = {
        start: Math.min(anchor, head),
        end: Math.max(anchor, head),
        dir: (anchor <= head) ? '->' : '<-',
      };
      this.codeCrock.restore(posJar);
    }

    this.updating = false;
  }

  highlight(editor: HTMLElement) {
    const pos = this.codeCrock.save();

    if (!this.highlighter) {
      editor.innerHTML = editor.textContent;
    } else {
      const content = editor.textContent;
      editor.innerHTML = this.highlighter.highlight(content, this.decorator) ||
        content;
    }

    this.codeCrock.restore(pos);

    refreshNumbers(this.lineNumbers, editor);
    this.decorator.refresh();
  }

  update(
    updateNode: PmNode,
    decorations: readonly Decoration[],
    innerDecorations: DecorationSource,
  ) {
    if (updateNode.attrs.type !== this.node.attrs.type) {
      return false; // recreate NodeView
    }

    const { state } = this.view;
    const pos = this.getPos();

    const isSelected = pos &&
      state.selection.from <= pos &&
      state.selection.to >= pos + updateNode.nodeSize;

    const codeDecorations: Decoration[] = [];

    innerDecorations
      .forEachSet((set) =>
        set.find()
          .map((d) => {
            codeDecorations.push(d);
          })
      );

    const decors: DecorationInline[] = [];

    for (const cd of codeDecorations) {
      if (cd.spec?.refresh) {
        this.decorator.refreshers.push(cd.spec?.refresh);
      }
      decors.push({
        startIndex: cd.from,
        endIndex: cd.to,
        attrs: {
          class: cd.spec.class,
          'data-decoration-id': cd.spec['data-decoration-id'],
        },
        // class: cd.spec.class || '',
        // decorationId: cd.spec.decorationId || '',
        // title: type?.attrs?.title || '',
      });
    }

    const oldDecors = this.decorator.decorationGroups.diag;
    this.decorator.decorationGroups.diag = decors;

    const oldNode = this.node;

    const content = this.codeCrock.toString();

    const change = computeChange(
      content,
      updateNode.textContent,
    );

    if (change) {
      const savedPos = this.codeCrock.save();

      const pos = applyChangeOverPos(savedPos, change);

      this.updating = true;
      this.codeCrock.updateCode(updateNode.textContent, true);
      this.updating = false;

      // TODO fix for yjs collab
      // change.from, change.to, change.text.length
      if (pos) {
        this.codeCrock.restore(pos);
      }
    } else {
      // if (JSON.stringify(oldDecors) !== JSON.stringify(decors)) {
      // }
    }
    this.codeCrock.forceHighlight();

    this.node = updateNode;
    if (updateNode.attrs.lang !== oldNode.attrs.lang) {
      this.setLang(updateNode.attrs.lang);
    }

    return true;
  }

  selectNode() {
    this.dom.classList.add('focused');
    this.element.focus();
  }

  deselectNode() {
    this.dom.classList.remove('focused');
  }

  stopEvent(_e: Event) {
    return false;
    // return true;
  }

  ignoreMutation() {
    return true;
  }

  frame: undefined | ReturnType<typeof requestAnimationFrame>;

  handleMove(e: MouseEvent) {
    this.forceUpdateDecorations = true;
    return;
    if (this.frame) return;

    this.frame = requestAnimationFrame(async () => {
      this.frame = undefined;

      let range;

      if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
        if (!pos) return;
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
      } else if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(e.clientX, e.clientY);
      }

      if (range) {
        const node = range.startContainer;
        const offset = range.startOffset;

        const domOffset = new DomOffset(this.element, node, offset);

        const { charCount, line, character } = domOffset;

        const client = this.extensionLsp?.getClient(this.lang);
        if (client) {
          const hover = await client.request(
            'textDocument/hover',
            {
              textDocument: {
                uri: this.uri,
              },
              position: {
                line,
                character,
              },
            },
          );

          if (hover?.range?.start && hover?.range?.end) {
            const start = domOffset.calculateOffsetFromLsp(hover?.range.start);
            const end = domOffset.calculateOffsetFromLsp(hover?.range.end);

            if (start < end) {
              console.log('hover', hover.contents, hover.range, start, end);
            }
          }

          // client.workspace.changedFile(
          //   this.uri,
          // );
        }
      }
    });
  }

  destroy() {
    this.dom.removeEventListener('mousemove', this.handleMove);

    const tr = this.view.state.tr;
    tr.setMeta('workspace', {
      operation: 'closeFile',
      node: this.node,
      pos: this.getPos(),
      uri: this.uri,
    });
    this.view.dispatch(tr);

    const client = this.extensionLsp?.getClient(this.lang);
    if (client) {
      if (this.uri) {
        client.disconnect(this.uri);
      }
      if (this.diagListener) {
        client.removeEventListener(
          'textDocument/publishDiagnostics',
          this.diagListener,
        );
      }
    }
    this.codeCrock.destroy();
  }
}

function applyChangeOverPos(
  pos: Position | undefined,
  change: { from: number; to: number; text: string },
): Position | undefined {
  if (!pos) {
    return pos;
  }

  const lenGrowth = change.text.length - (change.to - change.from);
  if (!lenGrowth) {
    return pos;
  }

  pos = { ...pos };

  if (change.to <= pos.start) {
    pos.start += lenGrowth;
  }
  if (change.to <= pos.end) {
    pos.end += lenGrowth;
  }

  return pos;
}
