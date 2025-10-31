// From prosemirror guide
import {
  Command,
  EditorState,
  Selection,
  TextSelection,
  Transaction,
} from 'prosemirror-state';
import { EditorView as PMEditorView } from 'prosemirror-view';
import { Node } from 'prosemirror-model';

import { EditorView } from '@codemirror/view';
import { Compartment } from '@codemirror/state';

import type { CodeBlockSettings, ThemeItem } from './types.ts';
import type { CoreEditor } from '@kerebron/editor';

export const CodeBlockNodeName = 'code_block';

function nonEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}

export function computeChange(oldVal: string, newVal: string) {
  if (oldVal === newVal) return null;
  let start = 0;
  let oldEnd = oldVal.length;
  let newEnd = newVal.length;
  while (
    start < oldEnd &&
    oldVal.charCodeAt(start) === newVal.charCodeAt(start)
  ) {
    start += 1;
  }
  while (
    oldEnd > start &&
    newEnd > start &&
    oldVal.charCodeAt(oldEnd - 1) === newVal.charCodeAt(newEnd - 1)
  ) {
    oldEnd -= 1;
    newEnd -= 1;
  }
  return { from: start, to: oldEnd, text: newVal.slice(start, newEnd) };
}

export const asProseMirrorSelection = (
  pmDoc: Node,
  cmView: EditorView,
  getPos: (() => number) | boolean,
) => {
  const offset = (typeof getPos === 'function' ? getPos() || 0 : 0) + 1;
  const anchor = cmView.state.selection.main.from + offset;
  const head = cmView.state.selection.main.to + offset;
  return TextSelection.create(pmDoc, anchor, head);
};

export const forwardSelection = (
  cmView: EditorView,
  pmView: PMEditorView,
  getPos: (() => number) | boolean,
) => {
  if (!cmView.hasFocus) return;
  const selection = asProseMirrorSelection(pmView.state.doc, cmView, getPos);
  if (!selection.eq(pmView.state.selection)) {
    pmView.dispatch(pmView.state.tr.setSelection(selection));
  }
};

export const valueChanged = (
  textUpdate: string,
  node: Node,
  getPos: (() => number) | boolean,
  view: PMEditorView,
) => {
  const change = computeChange(node.textContent, textUpdate);

  if (change && typeof getPos === 'function') {
    const start = getPos() + 1;

    let pmTr = view.state.tr;
    pmTr = pmTr.replaceWith(
      start + change.from,
      start + change.to,
      change.text ? view.state.schema.text(change.text) : [],
    );
    view.dispatch(pmTr);
  }
};

export const maybeEscape = (
  unit: 'char' | 'line',
  dir: -1 | 1,
  cm: EditorView,
  view: PMEditorView,
  getPos: boolean | (() => number),
) => {
  const sel = cm.state.selection.main;
  const line = cm.state.doc.lineAt(sel.from);
  const lastLine = cm.state.doc.lines;
  if (
    sel.to !== sel.from ||
    line.number !== (dir < 0 ? 1 : lastLine) ||
    (unit === 'char' && sel.from !== (dir < 0 ? 0 : line.to)) ||
    typeof getPos !== 'function'
  ) {
    return false;
  }
  view.focus();
  const node = view.state.doc.nodeAt(getPos());
  if (!node) return false;
  const targetPos = getPos() + (dir < 0 ? 0 : node.nodeSize);
  const selection = Selection.near(view.state.doc.resolve(targetPos), dir);
  view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
  view.focus();
  return true;
};

export const backspaceHandler = (
  pmView: PMEditorView,
  view: EditorView,
  editor: CoreEditor,
) => {
  const { selection } = view.state;
  if (selection.main.empty && selection.main.from === 0) {
    editor.run.setBlockType(pmView.state.schema.nodes.paragraph)(
      pmView.state,
      pmView.dispatch,
    );
    setTimeout(() => pmView.focus(), 20);
    return true;
  }
  return false;
};

export const setMode = async (
  lang: string,
  cmView: EditorView,
  settings: CodeBlockSettings,
  languageConf: Compartment,
) => {
  const support = await settings.languageLoaders?.[lang]?.();
  if (support) {
    cmView.dispatch({
      effects: languageConf.reconfigure(support),
    });
  }
};

const isTheme = (theme: Array<ThemeItem | undefined>): theme is ThemeItem[] => {
  if (!Array.isArray(theme)) {
    return false;
  }
  return theme.every(
    (item) =>
      item !== undefined &&
      typeof item.extension === 'object' && // or whatever type Extension is
      typeof item.name === 'string',
  );
};

export const setTheme = async (
  cmView: EditorView,
  themeConfig: Compartment,
  theme: Array<ThemeItem | undefined>,
) => {
  if (isTheme(theme)) {
    cmView.dispatch({
      effects: themeConfig.reconfigure(theme),
    });
  }
};

const arrowHandler: (dir: 'left' | 'right' | 'up' | 'down') => Command =
  (dir) =>
  (
    state: EditorState,
    dispatch: ((tr: Transaction) => void) | undefined,
    view?: PMEditorView,
  ): boolean => {
    if (state.selection.empty && view?.endOfTextblock(dir)) {
      const side = dir === 'left' || dir === 'up' ? -1 : 1;
      const { $head } = state.selection;
      const nextPos = Selection.near(
        state.doc.resolve(side > 0 ? $head.after() : $head.before()),
        side,
      );
      if (
        nextPos.$head &&
        nextPos.$head.parent.type.name === CodeBlockNodeName
      ) {
        dispatch?.(state.tr.setSelection(nextPos));
        return true;
      }
    }
    return false;
  };

export const createCodeBlock = (
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  attributes: object,
) => {
  const { $from, $to } = state.selection;
  //if we are in a CodeBlock node we do nothing
  const parentNode = $from.node($from.depth);
  if (parentNode && parentNode.type.name === CodeBlockNodeName) {
    return false;
  }
  //if from and to in the same paragraph
  if (
    $from.parentOffset === $to.parentOffset &&
    $from.parent.type.name === 'paragraph'
  ) {
    const text = $from.parent.textContent;
    const tr = state.tr;
    const newNode = state.schema.nodes[CodeBlockNodeName].createAndFill(
      attributes,
      text ? [state.schema.text($from.parent.textContent)] : [],
    );
    if (newNode && dispatch) {
      const pos = $from.before($from.depth);
      tr.delete(pos, pos + $from.parent.nodeSize - 1);
      tr.insert(pos, newNode);
      tr.setSelection(TextSelection.create(tr.doc, $from.pos));
      dispatch(tr);
    }
    return true;
  }

  if (dispatch) {
    const tr = state.tr;

    const slice = state.doc.slice(
      $from.before($from.depth),
      $to.after($to.depth),
      true,
    );
    const content = slice.content.textBetween(0, slice.content.size, '\n');
    const newNode = state.schema.nodes[CodeBlockNodeName].createAndFill(
      attributes,
      state.schema.text(content),
    );

    if (newNode) {
      tr.delete(
        $from.before(slice.openStart + 1),
        $to.after(slice.openEnd + 1),
      );
      tr.insert($from.before(slice.openStart + 1), newNode);
      tr.setSelection(
        TextSelection.create(
          tr.doc,
          $from.pos,
          $from.pos + newNode.nodeSize - 2,
        ),
      );
      dispatch(tr);
    }
  }
  return true;
};

export const removeCodeBlock = (
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
) => {
  const { $from } = state.selection;
  const parentNode = $from.node($from.depth);
  if (parentNode && parentNode.type.name === CodeBlockNodeName) {
    const children: Node[] = [];
    parentNode.forEach((child) => {
      children.push(child);
    });
    const childrenNodes = children
      .map((child) => {
        return state.schema.nodes.paragraph.createAndFill({}, [child]);
      })
      .filter(nonEmpty);
    const tr = state.tr;
    const pos = $from.before($from.depth);
    tr.delete(pos, pos + parentNode.nodeSize - 1);
    tr.insert(pos, childrenNodes);
    tr.setSelection(TextSelection.create(tr.doc, $from.pos - 1));
    if (dispatch) {
      dispatch(tr.scrollIntoView());
    }
  }
  return false;
};

export const toggleCodeBlock = (
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  attributes: object,
) => {
  const { $from } = state.selection;
  if ($from.pos === 0) {
    return false;
  }
  const parentNode = $from.node($from.depth);

  if (parentNode && parentNode.type.name === CodeBlockNodeName) {
    return removeCodeBlock(state, dispatch);
  } else {
    return createCodeBlock(state, dispatch, attributes);
  }
};

export const codeBlockArrowHandlers = {
  ArrowLeft: arrowHandler('left'),
  ArrowRight: arrowHandler('right'),
  ArrowUp: arrowHandler('up'),
  ArrowDown: arrowHandler('down'),
};

export const codeBlockToggleShortcut = {
  'Mod-Alt-c': toggleCodeBlock as Command,
};

export const codeBlockKeymap = {
  ...codeBlockToggleShortcut,
  ...codeBlockArrowHandlers,
};
