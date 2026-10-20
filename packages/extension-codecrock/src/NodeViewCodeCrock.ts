import { Node as PmNode } from 'prosemirror-model';
import {
  Decoration,
  DecorationAttrs,
  DecorationSource,
  EditorView,
  NodeView,
  NodeViewConstructor,
} from 'prosemirror-view';

import { CoreEditor } from '@kerebron/editor';
import { getRuntimeUri } from '@kerebron/editor/uri';
import { Workspace } from '@kerebron/workspace';
import type { GetLocalPos } from '@kerebron/ui/utilities/dom';

import { CodeCrock, Position } from './CodeCrock.ts';
import { TreeSitterHighlighter } from './TreeSitterHighlighter.ts';
import { DecorationInline, Decorator } from './Decorator.ts';
import { refreshNumbers } from './codeCrockLineNumbers.ts';
import { NodeCodeCrockConfig } from './NodeCodeCrock.ts';
import {
  applyChangeOverPos,
  computeChange,
  forwardSelection,
  performSnapshot,
  STOP_EVENTS,
  valueChanged,
} from './utils.ts';
import {
  addEditable,
  addLanguageDropDown,
  addLineNumbers,
  CodeNodeView,
} from './ui.ts';

export class NodeViewCodeCrock implements NodeView, CodeNodeView {
  node: PmNode;
  readonly view: EditorView;
  readonly getPos: () => number | undefined;

  dom: HTMLDivElement;
  codeCrock: CodeCrock;
  updating: boolean;
  editable: HTMLDivElement;
  highlighter: TreeSitterHighlighter;
  decorator: Decorator;
  languageDropDown: HTMLSelectElement;
  lineNumbers: HTMLElement;

  lang: string;
  workspace: Workspace;

  constructor(
    public readonly editor: CoreEditor,
    public readonly config: NodeCodeCrockConfig,
    ...args: Parameters<NodeViewConstructor>
  ) {
    this.node = args[0];
    this.view = args[1];
    this.getPos = args[2];

    this.lang = this.node.attrs.lang || 'plaintext';

    this.workspace = editor.ci.resolve('workspace')!;

    this.updating = false;
    const dom = document.createElement('div');
    this.dom = dom;
    dom.className = 'codecrock-root';

    this.languageDropDown = addLanguageDropDown(this);

    const root = (editor.view && 'root' in editor.view)
      ? editor.view.root
      : document || document;

    const { codeCrock, editable } = addEditable(this);
    this.editable = editable;
    const getLocalPos: GetLocalPos = (textOffset: number) => {
      const element = this.editable;
      const nodePos = this.getPos() || 0;
      const precisePos = nodePos + 1 + textOffset;

      return {
        pos: precisePos,
        nodePos,
        node: this.node,
        textOffset,
        element,
      };
    };
    (editable as any).getLocalPos = getLocalPos;

    this.codeCrock = codeCrock;

    this.codeCrock.addEventListener('selectionchange', () => {
      if (!this.updating) {
        forwardSelection(this.codeCrock, this.view, this.getPos);
      }
    });

    this.codeCrock.onUpdate(() => {
      if (!this.updating) {
        const textUpdate = this.codeCrock.toString();
        valueChanged(textUpdate, this.node, this.getPos, this.view);
        if (document.activeElement === this.editable) {
          forwardSelection(this.codeCrock, this.view, this.getPos);
        }

        const { version, getContentMapper } = performSnapshot(
          this,
          this.codeCrock,
        );

        const uri = getRuntimeUri(this.node);
        if (uri) {
          this.workspace.modifyFile({
            lang: this.lang,
            uri,
            version,
            getContentMapper,
            getPos: () => this.getPos(),
          });
        }
      }
    });

    this.highlighter = new TreeSitterHighlighter(this.editor.config.assetLoad!);
    this.decorator = new Decorator();

    this.lineNumbers = addLineNumbers(this, this.editable);
  }

  setLang(lang: string) {
    this.languageDropDown.value = lang || '';
    this.lang = lang;

    const { version, getContentMapper } = performSnapshot(this, this.codeCrock);

    const uri = getRuntimeUri(this.node);
    if (uri) {
      this.workspace.openFile({
        uri,
        lang,
        version,
        getContentMapper,
        getPos: () => this.getPos(),
      });
    }

    this.highlighter.init(lang)
      .then(() => {
        this.highlight(this.editable);
      });
  }

  init() {
    this.codeCrock.updateCode(this.node.textContent, false);
    if (this.node.attrs.lang) {
      this.setLang(this.node.attrs.lang);
    }
  }

  setSelection(anchor: number, head: number) {
    this.editable.focus();
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

  highlight(editable: HTMLElement) {
    const pos = this.codeCrock.save();

    if (!this.highlighter) {
      editable.innerHTML = editable.textContent;
    } else {
      const content = editable.textContent;
      editable.innerHTML =
        this.highlighter.highlight(content, this.decorator) ||
        content;
    }

    this.codeCrock.restore(pos);

    refreshNumbers(this.lineNumbers, editable);
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
    console.log('nvupdate', codeDecorations.length);

    for (const cd of codeDecorations) {
      const attrs: DecorationAttrs = (cd as any).type.attrs || {};

      // console.log('coppppppp ccdeooooo', cd.from, cd.to, cd );

      if (cd.spec?.refresh) {
        this.decorator.refreshers.push(cd.spec?.refresh);
      }

      {
        const decor = (cd as any).type;
        if (decor.toDOM) {
          console.log('toDOM', decor.toDOM());
        }
      }

      decors.push({
        startIndex: cd.from,
        endIndex: cd.to,
        attrs: Object.fromEntries(
          Object.entries(attrs).map((e) => [e[0], e[1] || '']),
        ),
        toDOM: (cd as any).type.toDOM,
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
    this.editable.focus();
  }

  deselectNode() {
    this.dom.classList.remove('focused');
  }

  stopEvent(event: Event) {
    return STOP_EVENTS.includes(event.type);
  }

  ignoreMutation() {
    return true;
  }

  destroy() {
    const uri = getRuntimeUri(this.node);
    if (uri) {
      this.workspace.closeFile(uri);
    }
    this.codeCrock.destroy();
  }
}
