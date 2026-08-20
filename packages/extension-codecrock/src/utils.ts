import { Node } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';
import { CodeCrock, Position } from './CodeCrock.ts';
import { TextSelection } from 'prosemirror-state';

import { CodeContentMapper } from '@kerebron/workspace/CodeContentMapper';

import { CodeNodeView } from './ui.ts';

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

export const valueChanged = (
  textUpdate: string,
  node: Node,
  getPos: () => number | undefined,
  view: EditorView,
) => {
  const change = computeChange(node.textContent, textUpdate);

  if (change) {
    const pos = getPos();
    if ('undefined' !== typeof pos) {
      const start = pos + 1;

      let pmTr = view.state.tr;
      pmTr = pmTr.replaceWith(
        start + change.from,
        start + change.to,
        change.text ? view.state.schema.text(change.text) : [],
      );
      view.dispatch(pmTr);
    }
  }
};

export const forwardSelection = (
  codeCrock: CodeCrock,
  pmView: EditorView,
  getPos: () => number | undefined,
) => {
  // if (!cmView.hasFocus) return;
  const codeCrockPos = codeCrock.save();
  if (!codeCrockPos) {
    return;
  }
  const selection = asProseMirrorSelection(
    pmView.state.doc,
    codeCrockPos,
    getPos,
  );
  if (!selection.eq(pmView.state.selection)) {
    pmView.dispatch(pmView.state.tr.setSelection(selection));
  }
};

const asProseMirrorSelection = (
  pmDoc: Node,
  pos: Position,
  getPos: () => number | undefined,
) => {
  const offset = (typeof getPos === 'function' ? getPos() || 0 : 0) + 1;
  if (pos.dir === '<-') {
    return TextSelection.create(pmDoc, pos.start + offset, pos.end + offset);
  } else {
    return TextSelection.create(pmDoc, pos.end + offset, pos.start + offset);
  }
};

export function applyChangeOverPos(
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

export function replaceExt(uri: string, lang: string) {
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

export const STOP_EVENTS = [
  'keydown',
  'keyup',
  'keypress',
  'beforeinput',
  'input',
  'compositionstart',
  'compositionupdate',
  'compositionend',
  'paste',
  'cut',
  'copy',
  'dragstart',
  'dragover',
  'drop',
];

export interface SnapshotCtx {
  version: number;
  text: string;
  materialized?: CodeContentMapper;
}

export function performSnapshot(nodeView: CodeNodeView, codeCrock: CodeCrock) {
  const version = nodeView.editor.version;
  const ctx: SnapshotCtx = {
    version,
    text: codeCrock.toString(),
    materialized: undefined,
  };
  const getContentMapper = async () => {
    if (ctx.materialized) {
      return ctx.materialized;
    }
    ctx.materialized = CodeContentMapper.create(ctx.text);
    return ctx.materialized;
  };

  return { version, getContentMapper };
}
