import { EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

import { TextRange } from '@kerebron/editor';

export function autoDecorationSet(
  state: EditorState,
  range: TextRange,
  attrs: Record<string, string>,
) {
  if (range.from === range.to) {
    return DecorationSet.create(state.doc, [
      Decoration.widget(range.from, () => {
        const widgetNode = document.createElement('span');
        widgetNode.className = attrs.class;
        for (const [k, v] of Object.entries(attrs)) {
          widgetNode.setAttribute(k, v);
        }
        return widgetNode;
      }, attrs),
    ]);
  } else {
    return DecorationSet.create(state.doc, [
      Decoration.inline(range.from, range.to, {
        ...attrs,
      }),
    ]);
  }
}
