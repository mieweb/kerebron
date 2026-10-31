import { Node as PmNode } from 'prosemirror-model';
import {
  Decoration,
  DecorationSource,
  EditorView,
  NodeView,
  NodeViewConstructor,
} from 'prosemirror-view';

import { CoreEditor } from '@kerebron/editor';
import { Workspace } from '@kerebron/workspace';

import {
  CodeCrock,
  Position,
} from '@kerebron/extension-codecrock/CodeCrock.ts';
import { TreeSitterHighlighter } from '@kerebron/extension-codecrock/TreeSitterHighlighter.ts';
import {
  DecorationInline,
  Decorator,
} from '@kerebron/extension-codecrock/Decorator.ts';
import { refreshNumbers } from '@kerebron/extension-codecrock/codeCrockLineNumbers.ts';

import {
  addEditable,
  addLanguageDropDown,
  addLineNumbers,
  addResultsElement,
  CodeNodeView,
} from '@kerebron/extension-codecrock/ui';
import {
  applyChangeOverPos,
  computeChange,
  forwardSelection,
  performSnapshot,
  replaceExt,
  STOP_EVENTS,
  valueChanged,
} from '@kerebron/extension-codecrock/utils.ts';

import { NodeCodeCellConfig } from './NodeCodeCell.ts';
import { addToolbar } from './ui.ts';

export interface CodeCellNodeView extends CodeNodeView {
  setResult(aa): void;
}

interface JupyterResult {
  strerr?: string;
  errors: Array<string>;
  results: Array<{
    execution_count: number;
    data: Record<string, string>;
  }>;
}

export class NodeViewCodeCell implements NodeView, CodeCellNodeView {
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
  resultsElement: HTMLElement;

  lang: string = 'plaintext';
  uri: string = 'file:///' + Math.random() + '.txt';
  workspace: Workspace;

  constructor(
    readonly editor: CoreEditor,
    readonly config: NodeCodeCellConfig,
    ...args: Parameters<NodeViewConstructor>
  ) {
    this.node = args[0];
    this.view = args[1];
    this.getPos = args[2];

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
    this.codeCrock = codeCrock;

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

        this.workspace.modifyFile({
          lang: this.lang,
          uri: this.uri,
          version,
          getContentMapper,
          getPos: () => this.getPos(),
        });
      }
    });

    this.highlighter = new TreeSitterHighlighter(this.editor.config.assetLoad!);
    this.decorator = new Decorator();

    this.lineNumbers = addLineNumbers(this, this.editable);
    addToolbar(this);
    this.resultsElement = addResultsElement(this);
  }

  setLang(lang: string) {
    this.languageDropDown.value = lang || '';
    this.lang = lang;

    this.uri = replaceExt(this.uri, lang);
    this.editable.setAttribute('data-uri', this.uri);

    const { version, getContentMapper } = performSnapshot(this, this.codeCrock);

    this.workspace.openFile({
      uri: this.uri,
      lang,
      version,
      getContentMapper,
      getPos: () => this.getPos(),
    });

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
          title: cd.spec.title,
        },
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
      console.info('codeCrock.updateCode');
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
    this.workspace.closeFile(this.uri);
    this.codeCrock.destroy();
  }

  setResult(result: JupyterResult) {
    this.resultsElement.innerHTML = '';

    if (result.strerr) {
      const element = document.createElement('div');
      this.resultsElement.append(element);
      element.innerText = result.strerr;
    }
    for (const item of result.results) {
      const element = document.createElement('div');
      this.resultsElement.append(element);

      if (item.data['image/svg+xml']) {
        element.innerHTML = item.data['image/svg+xml'];
      } else if (item.data['text/html']) {
        element.innerHTML = item.data['text/html'];
      }
    }

    console.log('setResult', result);
  }
}
