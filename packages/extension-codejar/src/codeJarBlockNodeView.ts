import { Node } from 'prosemirror-model';
import {
  Decoration,
  DecorationSource,
  EditorView,
  EditorView as PMEditorView,
  NodeView,
} from 'prosemirror-view';

import { CoreEditor } from '@kerebron/editor';

import { CodeJar, Position } from './CodeJar.ts';
import { computeChange, forwardSelection, valueChanged } from './utils.ts';
import { TreeSitterHighlighter } from './TreeSitterHighlighter.ts';
import { DecorationInline, Decorator } from './Decorator.ts';
import { withLineNumbers } from './codeJarLineNumbers.ts';
import { NodeCodeJarConfig } from './NodeCodeJar.ts';

class CodeJarBlockNodeView implements NodeView {
  dom: HTMLDivElement;
  codeJar: CodeJar;
  updating: boolean;
  element: HTMLDivElement;
  highlighter: TreeSitterHighlighter;
  decorator: Decorator;

  constructor(
    private node: Node,
    private view: EditorView,
    private getPos: () => number | undefined,
    private settings: NodeCodeJarConfig,
    private editor: CoreEditor,
  ) {
    this.updating = false;
    const dom = document.createElement('div');
    this.dom = dom;
    dom.className = 'codeblock-root';

    const root = (editor.view && 'root' in editor.view)
      ? editor.view.root
      : document || document;

    this.element = document.createElement('div');
    this.element.classList.add('codejar');

    this.codeJar = new CodeJar(
      this.element,
      withLineNumbers((element) => this.highlight(element)),
      {
        tab: '  ',
        indentOn: new RegExp('^(?!)'),
        moveToNewLine: new RegExp('^(?!)'),
        history: false,
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
    });

    this.highlighter = new TreeSitterHighlighter();
    this.decorator = new Decorator();

    dom.append(this.element);
  }

  async init() {
    if (this.node.attrs.lang) {
      await this.highlighter.init(this.node.attrs.lang);
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
    const content = editor.textContent;
    editor.innerHTML = this.highlighter.highlight(content, this.decorator);
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
    this.node = updateNode;

    const content = this.codeJar.toString();

    const change = computeChange(
      content,
      this.node.textContent,
    );

    if (change) {
      const pos = this.codeJar.save();

      this.updating = true;
      this.codeJar.updateCode(this.node.textContent, true);
      this.updating = false;

      // TODO fix for yjs collab
      // change.from, change.to, change.text.length
      this.codeJar.restore(pos);
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
