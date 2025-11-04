import { Plugin } from 'prosemirror-state';
import type { CoreEditor } from '@kerebron/editor';

export class TrackSelecionPlugin extends Plugin {
  constructor(editor: CoreEditor) {
    super({
      view(editorView) {
        return {
          update(view, prevState) {
            const state = view.state;
            const prevSelection = prevState.selection;
            const selection = state.selection;

            if (!prevSelection.eq(selection)) {
              const event = new CustomEvent('selection', {
                detail: {
                  editor: this,
                  selection,
                },
              });
              editor.dispatchEvent(event);
            }
          },
        };
      },
    });
  }
}
