import { Node as PmNode } from 'prosemirror-model';
import { Selection, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import { CoreEditor } from '@kerebron/editor';

import { NodeCodeCrockConfig } from './NodeCodeCrock.ts';
import { CodeCrock } from './CodeCrock.ts';
import { initLineNumbers, lineNumberOptions } from './codeCrockLineNumbers.ts';
import { forwardSelection } from './utils.ts';

export interface CodeNodeView {
  readonly editor: CoreEditor;
  readonly node: PmNode;
  readonly view: EditorView;
  readonly getPos: () => number | undefined;

  dom: HTMLDivElement;

  config: NodeCodeCrockConfig;
  setLang(lang: string): void;
  highlight(element: HTMLElement): void;
}

export function addLanguageDropDown(nodeView: CodeNodeView) {
  const select = document.createElement('select');
  nodeView.dom.appendChild(select);
  select.classList.add('codecrock-select');
  for (const lang of [''].concat(nodeView.config.languageWhitelist || [])) {
    const option = document.createElement('option');
    option.value = lang;
    option.innerText = lang;
    select.appendChild(option);
  }
  select.addEventListener('change', async () => {
    const lang = select.value;
    const pos = nodeView.getPos();
    if (pos) {
      nodeView.view.dispatch(
        nodeView.view.state.tr.setNodeMarkup(pos, undefined, {
          ...nodeView.node.attrs,
          lang,
        }),
      );
    }
    nodeView.setLang(lang);
  });
  return select;
}

export function addEditable(nodeView: CodeNodeView, editor: CoreEditor) {
  const editable = document.createElement('div');
  nodeView.dom.appendChild(editable);
  editable.classList.add('codecrock');

  const codeCrock = new CodeCrock(
    editable,
    (element) => nodeView.highlight(element),
    {
      tab: '  ',
      indentOn: new RegExp('^(?!)'),
      moveToNewLine: new RegExp('^(?!)'),
      history: false,
      readOnly: nodeView.config.readOnly,
    },
  );

  const blur = (dir: 1 | -1) => {
    const pos = nodeView.getPos();
    if (typeof pos === 'undefined') {
      return false;
    }

    const view = nodeView.view;

    const targetPos = pos + (dir < 0 ? 0 : nodeView.node.nodeSize);
    const selection = Selection.near(
      view.state.doc.resolve(targetPos),
      dir,
    );

    const posInsideNodeView = selection.from >= pos &&
      selection.from < pos + nodeView.node.nodeSize;
    if (posInsideNodeView) {
      const newPosition = dir < 0 ? 0 : codeCrock.toString().length;
      codeCrock.restore({ start: newPosition, end: newPosition, dir: '->' });
      forwardSelection(
        codeCrock,
        nodeView.view,
        nodeView.getPos,
        nodeView.node,
      );
      return true;
    }

    view.dispatch(
      view.state.tr.setSelection(selection).scrollIntoView(),
    );
    view.focus();

    return true;
  };

  codeCrock.addEventListener('blur-previous', () => {
    blur(-1);
  });
  codeCrock.addEventListener('blur-next', () => {
    blur(1);
  });

  codeCrock.addEventListener('prepend-empty-line', () => {
    const pos = nodeView.getPos();
    if (typeof pos === 'undefined') {
      return;
    }
    editor.run.insertEmptyParagraph(pos);
  });
  codeCrock.addEventListener('append-empty-line', () => {
    const pos = nodeView.getPos();
    if (typeof pos === 'undefined') {
      return;
    }
    editor.run.insertEmptyParagraph(pos + nodeView.node.nodeSize);
  });

  codeCrock.addEventListener('convert-to-paragraph', () => {
    const pos = nodeView.getPos();
    if (typeof pos === 'undefined') {
      return;
    }
    const view = nodeView.view;
    const { state } = view;

    const text = codeCrock.toString();
    const paragraphs = text.split('\n').map((line) =>
      state.schema.nodes.paragraph.create(
        {},
        line ? state.schema.text(line) : undefined,
      )
    );
    const tr = state.tr.replaceWith(
      pos,
      pos + nodeView.node.nodeSize,
      paragraphs,
    );

    tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)));
    view.dispatch(tr);
    view.focus();
  });

  codeCrock.addEventListener('selectionchange', (event) => {
    forwardSelection(codeCrock, nodeView.view, nodeView.getPos, nodeView.node);
  });

  return { codeCrock, editable };
}

export function addLineNumbers(nodeView: CodeNodeView, editable: HTMLElement) {
  return initLineNumbers(nodeView.dom, editable, lineNumberOptions);
}

export function addResultsElement(nodeView: CodeNodeView) {
  const element = document.createElement('div');
  nodeView.dom.appendChild(element);
  return element;
}

// Length in UTF-16 code units of the code point ending at index `end - 1`.
export function precedingCodePointLength(value: string, end: number): number {
  const low = value.charCodeAt(end - 1);
  const high = value.charCodeAt(end - 2);
  return low >= 0xDC00 && low <= 0xDFFF && high >= 0xD800 && high <= 0xDBFF
    ? 2
    : 1;
}
