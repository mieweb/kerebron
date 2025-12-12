import { Node } from 'prosemirror-model';
import {
  Decoration,
  DecorationSource,
  EditorView,
  EditorView as PMEditorView,
  NodeView,
} from 'prosemirror-view';
import { Diagnostic } from 'vscode-languageserver-protocol';

import { CoreEditor, RawTextResult } from '@kerebron/editor';
import { PositionMapper } from '@kerebron/extension-markdown/PositionMapper';
import { ExtensionLsp, LspSource } from '@kerebron/extension-lsp';
import { toRawTextResult } from '@kerebron/editor/utilities';

import { CodeJar, Position } from './CodeJar.ts';
import { computeChange, forwardSelection, valueChanged } from './utils.ts';
import { TreeSitterHighlighter } from './TreeSitterHighlighter.ts';
import { DecorationInline, Decorator } from './Decorator.ts';
import {
  initLineNumbers,
  lineNumberOptions,
  refreshNumbers,
} from './codeJarLineNumbers.ts';
import { NodeCodeJarConfig } from './NodeCodeJar.ts';

class CodeJarBlockNodeView implements NodeView {
  dom: HTMLDivElement;
  codeJar: CodeJar;
  updating: boolean;
  element: HTMLDivElement;
  highlighter: TreeSitterHighlighter;
  decorator: Decorator;
  languageDropDown: HTMLSelectElement;
  lineNumbers: HTMLElement;

  source: LspSource;
  extensionLsp: ExtensionLsp | undefined;
  lang: string = 'plaintext';
  uri: string = 'file:///' + Math.random() + '.ts';
  diagListener: (event: Event) => void;

  constructor(
    private node: Node,
    private view: EditorView,
    private getPos: () => number | undefined,
    private config: NodeCodeJarConfig,
    private editor: CoreEditor,
  ) {
    this.updating = false;
    const dom = document.createElement('div');
    this.dom = dom;
    dom.className = 'codejar-root';

    this.languageDropDown = this.addLanguageDropDown();

    const root = (editor.view && 'root' in editor.view)
      ? editor.view.root
      : document || document;

    this.element = document.createElement('div');
    this.element.classList.add('codejar');

    this.codeJar = new CodeJar(
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

    this.codeJar.onUpdate(() => {
      if (!this.updating) {
        const textUpdate = this.codeJar.toString();
        valueChanged(textUpdate, this.node, getPos, view);
        if (document.activeElement === this.element) {
          forwardSelection(this.codeJar, view, getPos);
        }
      }

      const client = this.extensionLsp?.getClient(this.lang);
      if (client) {
        client.workspace.changedFile(
          this.uri,
        );
      }
    });

    this.highlighter = new TreeSitterHighlighter();
    this.highlighter.cdnUrl = this.editor.config.cdnUrl;
    this.decorator = new Decorator();

    dom.append(this.element);

    this.lineNumbers = initLineNumbers(this.element, lineNumberOptions);

    this.source = {
      ui: this.editor.ui,
      getMappedContent: () => {
        const editor = this.editor;
        const result: RawTextResult = toRawTextResult(
          this.codeJar.toString(),
          0,
        );
        const mapper = new PositionMapper(editor, result.rawTextMap);
        return {
          ...result,
          mapper,
        };
      },
    };

    this.extensionLsp = editor.getExtension('lsp');

    let lastDiag = 0;
    this.diagListener = (event: Event) => {
      const detail = (event as CustomEvent).detail;
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
          console.log({
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
              className: 'kb-lsp__error',
              title: diag.message || '',
            });
          }

          this.decorator.decorationGroups.innerDiag = decors;
          this.highlight(this.element);
        }
      }
    };
  }

  addLanguageDropDown() {
    const select = document.createElement('select');
    select.classList.add('codejar-select');
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
    await this.highlighter.init(this.node.attrs.lang);
    this.languageDropDown.value = this.node.attrs.lang || '';
    this.highlight(this.element);
    this.lang = lang;

    const client = this.extensionLsp?.getClient(this.lang);
    if (client) {
      client.addEventListener(
        'textDocument/publishDiagnostics',
        this.diagListener,
      );

      client.connect(this.uri, this.source);
      client.workspace.openFile(
        this.uri,
        lang,
        this.source,
      );
    }
  }

  async init() {
    this.codeJar.updateCode(this.node.textContent, false);
    if (this.node.attrs.lang) {
      await this.setLang(this.node.attrs.lang);
    }
  }

  setSelection(anchor: number, head: number) {
    this.element.focus();
    this.updating = true;

    const pos = this.getPos();
    if (pos) {
      anchor -= pos;
      head -= pos;

      const posJar: Position = {
        start: Math.min(anchor, head),
        end: Math.max(anchor, head),
        dir: (anchor <= head) ? '->' : '<-',
      };
      this.codeJar.restore(posJar);
    }

    this.updating = false;
  }

  highlight(editor: HTMLElement) {
    // const highlight = withLineNumbers((element) => this.highlight(element));
    if (!this.highlighter) {
      editor.innerHTML = editor.textContent;
    } else {
      const content = editor.textContent;
      editor.innerHTML = this.highlighter.highlight(content, this.decorator) ||
        content;
    }
    refreshNumbers(this.lineNumbers, editor);
  }

  update(
    updateNode: Node,
    _decorations: readonly Decoration[],
    innerDecorations: DecorationSource,
  ) {
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
      if ('type' in cd) {
        const type = cd.type;
        decors.push({
          startIndex: cd.from,
          endIndex: cd.to,
          className: type?.attrs?.class || '',
          title: type?.attrs?.title || '',
        });
      }
    }

    this.decorator.decorationGroups.diag = decors;

    const oldNode = this.node;

    const content = this.codeJar.toString();

    const change = computeChange(
      content,
      updateNode.textContent,
    );

    if (change) {
      const pos = this.codeJar.save();

      this.updating = true;
      this.codeJar.updateCode(updateNode.textContent, true);
      this.updating = false;

      // TODO fix for yjs collab
      // change.from, change.to, change.text.length
      if (pos) {
        this.codeJar.restore(pos);
      }
    }

    this.node = updateNode;

    if (updateNode.attrs.lang !== oldNode.attrs.lang) {
      this.setLang(updateNode.attrs.lang);
    }

    return true;
  }

  selectNode() {
    this.element.focus();
  }

  stopEvent(_e: Event) {
    return true;
  }

  ignoreMutation() {
    return true;
  }

  destroy() {
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
    this.codeJar.destroy();
  }
}

export const codeJarBlockNodeView: (
  settings: NodeCodeJarConfig,
  editor: CoreEditor,
) => (
  node: Node,
  view: EditorView,
  getPos: () => number | undefined,
  decorations: readonly Decoration[],
  innerDecorations: DecorationSource,
) => NodeView = (settings, editor) => {
  return (
    pmNode: Node,
    view: PMEditorView,
    getPos: () => number | undefined,
  ) => {
    const plugin = new CodeJarBlockNodeView(
      pmNode,
      view,
      getPos,
      settings,
      editor,
    );
    plugin.init();
    return plugin;
  };
};
