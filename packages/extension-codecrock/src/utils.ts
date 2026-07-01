import { Node } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';
import { CodeCrock, Position } from './CodeCrock.ts';
import { TextSelection } from 'prosemirror-state';

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
