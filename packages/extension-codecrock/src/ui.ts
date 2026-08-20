import { Node as PmNode } from 'prosemirror-model';
import { Selection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import { CoreEditor } from '@kerebron/editor';

import { NodeCodeCrockConfig } from './NodeCodeCrock.ts';
import { CodeCrock, Position } from './CodeCrock.ts';
import { initLineNumbers, lineNumberOptions } from './codeCrockLineNumbers.ts';

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

export function addEditable(nodeView: CodeNodeView) {
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
    nodeView.view.focus();
    const pos = nodeView.getPos();
    if (typeof pos === 'undefined') {
      return false;
    }

    const targetPos = pos + (dir < 0 ? 0 : nodeView.node.nodeSize);
    const selection = Selection.near(
      nodeView.view.state.doc.resolve(targetPos),
      dir,
    );

    nodeView.view.dispatch(
      nodeView.view.state.tr.setSelection(selection).scrollIntoView(),
    );
    // this.view.focus();
    // editor.chain().ArrowDown().run();

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
      return false;
    }
    nodeView.editor.chain().replaceRangeText({ from: pos, to: pos }, '').run();
  });
  codeCrock.addEventListener('append-empty-line', () => {
    const pos = nodeView.getPos();
    if (typeof pos === 'undefined') {
      return false;
    }
    nodeView.editor.chain().replaceRangeText({
      from: pos + nodeView.node.nodeSize,
      to: pos + nodeView.node.nodeSize,
    }, '').run();
  });

  codeCrock.addEventListener('selectionchange', (event) => {
    const pos: Position | undefined = (event as CustomEvent).detail;
    if (!pos) {
      return;
    }
    const selection = Selection.near(
      nodeView.view.state.doc.resolve(pos.start),
      pos.end - pos.start,
    );

    nodeView.view.dispatch(
      nodeView.view.state.tr.setSelection(selection),
    );
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
