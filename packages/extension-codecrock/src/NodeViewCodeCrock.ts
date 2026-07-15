import { Node as PmNode } from 'prosemirror-model';
import { Selection } from 'prosemirror-state';
import {
  Decoration,
  DecorationSource,
  EditorView,
  NodeView,
  NodeViewConstructor,
} from 'prosemirror-view';

import { CoreEditor } from '@kerebron/editor';
import { debounce } from '@kerebron/editor/utilities';

import { CodeCrock, Position } from './CodeCrock.ts';
import { computeChange, forwardSelection, valueChanged } from './utils.ts';
import { TreeSitterHighlighter } from './TreeSitterHighlighter.ts';
import { DecorationInline, Decorator } from './Decorator.ts';
import {
  initLineNumbers,
  lineNumberOptions,
  refreshNumbers,
} from './codeCrockLineNumbers.ts';
import { NodeCodeCrockConfig } from './NodeCodeCrock.ts';
import { Workspace } from '@kerebron/workspace';
import { CodeContentMapper } from './CodeContentMapper.ts';

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

interface SnapshotCtx {
  version: number;
  text: string;
  materialized?: CodeContentMapper;
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
  workspace: Workspace;
  ctx?: SnapshotCtx;

  constructor(
    private editor: CoreEditor,
    private config: NodeCodeCrockConfig,
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

      const targetPos = pos + (dir < 0 ? 0 : this.node.nodeSize);
      const selection = Selection.near(
        this.view.state.doc.resolve(targetPos),
        dir,
      );

      this.view.dispatch(
        this.view.state.tr.setSelection(selection).scrollIntoView(),
      );
      // this.view.focus();
      // editor.chain().ArrowDown().run();

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

        const version = this.editor.version;
        const ctx: SnapshotCtx = {
          version,
          text: this.codeCrock.toString(),
          materialized: undefined,
        };
        const getContentMapper = async () => {
          if (ctx.materialized) {
            return ctx.materialized;
          }
          ctx.materialized = await CodeContentMapper.create(ctx.text);
          return ctx.materialized;
        };

        this.workspace.modifyFile({
          lang: this.lang,
          uri: this.uri,
          version,
          getContentMapper,
        });

        this.ctx = ctx;
      }
    });

    this.highlighter = new TreeSitterHighlighter();
    this.highlighter.assetLoad = this.editor.config.assetLoad;
    this.decorator = new Decorator();

    dom.append(this.element);

    this.lineNumbers = initLineNumbers(this.element, lineNumberOptions);

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
      this.setLang(lang);
    });
    return select;
  }

  setLang(lang: string) {
    this.languageDropDown.value = lang || '';
    this.lang = lang;

    this.uri = replaceExt(this.uri, lang);
    this.element.setAttribute('data-uri', this.uri);

    const version = this.editor.version;
    const ctx: SnapshotCtx = {
      version,
      text: this.codeCrock.toString(),
      materialized: undefined,
    };
    const getContentMapper = async () => {
      if (ctx.materialized) {
        return ctx.materialized;
      }
      ctx.materialized = await CodeContentMapper.create(ctx.text);
      return ctx.materialized;
    };

    this.workspace.openFile({
      uri: this.uri,
      lang,
      version,
      getContentMapper,
    });

    this.ctx = ctx;

    this.highlighter.init(lang)
      .then(() => {
        this.highlight(this.element);
      });
  }

  init() {
    this.codeCrock.updateCode(this.node.textContent, false);
    if (this.node.attrs.lang) {
      this.setLang(this.node.attrs.lang);
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
          title: cd.spec.title,
          'data-decoration-id': cd.spec['data-decoration-id'],
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

  stopEvent(event: Event) {
    const type = event.type;
    if (
      type === 'keydown' ||
      type === 'keyup' ||
      type === 'keypress' ||
      type === 'beforeinput' ||
      type === 'input' ||
      type === 'compositionstart' ||
      type === 'compositionupdate' ||
      type === 'compositionend' ||
      type === 'paste' ||
      type === 'cut' ||
      type === 'copy' ||
      type === 'dragstart' ||
      type === 'dragover' ||
      type === 'drop'
    ) {
      return true;
    }
    return false;
  }

  ignoreMutation() {
    return true;
  }

  frame: undefined | ReturnType<typeof requestAnimationFrame>;

  handleMove(e: MouseEvent) {
  }

  destroy() {
    this.dom.removeEventListener('mousemove', this.handleMove);
    this.workspace.closeFile(this.uri);
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
