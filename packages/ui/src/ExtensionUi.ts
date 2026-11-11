import { DOMOutputSpec, MarkType } from 'prosemirror-model';
import { EditorState, NodeSelection, Transaction } from 'prosemirror-state';

import { CommandFactories, Extension } from '@kerebron/editor';
import { CommandFactory, CommandShortcuts } from '@kerebron/editor/commands';
import {
  mediaUploadKey,
  uploadMediaFiles,
} from '@kerebron/extension-basic-editor/ExtensionMediaUpload';

import { Ui } from './Ui.ts';
import { bindReplace, bindSearch } from './events/searchBindings.ts';
import { PopupOptions } from './popup/types.ts';

import type { TemplatesRegistry } from './templates/mod.ts';
import { popupTemplateRegistry } from './templates/popupTemplateRegistry.ts';
import { roomTemplateRegistry } from './templates/roomTemplateRegistry.ts';

export class ExtensionUi extends Extension {
  name = 'ui';

  override getCommandFactories(): Partial<CommandFactories> {
    const editor = this.editor;

    const createPopup: CommandFactory = (
      options: PopupOptions,
    ) => {
      return function (state, dispatch) {
        if (dispatch && this) {
          const ui: Ui = editor.ci.resolve('ui')!;
          const popup = ui.createPopup(options);
          this.tr?.setMeta('popup', popup);
        }

        return true;
      };
    };

    const setPopupContent: CommandFactory = (
      spec: DOMOutputSpec,
    ) => {
      return function (state, dispatch) {
        if (dispatch && this) {
          const ui: Ui = editor.ci.resolve('ui')!;
          const popup = this.tr?.getMeta('popup');
          if (popup) {
            ui.setPopupContent(popup, spec);
          }
        }

        return true;
      };
    };

    const clearPopups: CommandFactory = () => {
      return () => {
        const ui: Ui = this.editor.ci.resolve('ui')!;
        ui.clearPopups();
        return true;
      };
    };

    const insertImage: CommandFactory = () => {
      const nodeType = this.editor.schema.nodes.image;
      const ui: Ui = this.editor.ci.resolve('ui')!;
      return function (
        state: EditorState,
        dispatch?: (tr: Transaction) => void,
      ) {
        if (dispatch) {
          let attrs = null;
          if (
            state.selection instanceof NodeSelection &&
            state.selection.node.type === nodeType
          ) {
            attrs = state.selection.node.attrs;
          }

          (async () => {
            const popup = ui.createPopup({
              anchorId: 'center',
              layer: 'overlayer',
              group: 'dialog',
            });

            const templates: TemplatesRegistry = editor.ci.resolve('templates');
            await ui.setPopupContent(
              popup,
              templates['insert-image']({ attrs }),
            );

            popup.addEventListener('submit', async (event: SubmitEvent) => {
              event.preventDefault();
              event.stopPropagation();

              const form = event.target as HTMLFormElement;
              const attrs = Object.fromEntries(new FormData(form).entries());

              const options = mediaUploadKey.getState(editor.state) || {};
              const fileInput = form.querySelector(
                '[type=file]',
              )! as HTMLInputElement;
              const file = fileInput.files?.[0];
              if (file) {
                const toInsert = await uploadMediaFiles([file], options);
                if (toInsert.length > 0) {
                  attrs.src = toInsert[0].src;
                  editor.view.dispatch(
                    editor.view.state.tr.replaceSelectionWith(
                      nodeType.createAndFill(attrs)!,
                    ),
                  );
                }
              }
              editor.view.focus();
              popup.remove();
            });
          })();
        }

        return true;
      };
    };

    function markActive(state: EditorState, type: MarkType) {
      let { from, $from, to, empty } = state.selection;
      if (empty) return !!type.isInSet(state.storedMarks || $from.marks());
      else return state.doc.rangeHasMark(from, to, type);
    }

    const toggleLink: CommandFactory = () => {
      const markType = editor.schema.marks.link;
      const ui: Ui = this.editor.ci.resolve('ui')!;

      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        if (markActive(state, markType)) {
          editor.commandFactories.toggleMark(markType).apply({
            editor,
          }, [
            state,
            dispatch,
          ]);
          return true;
        }

        if (dispatch) {
          let attrs: Record<string, string> | undefined;

          (async () => {
            const popup = ui.createPopup({
              anchorId: 'center',
              layer: 'overlayer',
              group: 'dialog',
            });

            const templates: TemplatesRegistry = editor.ci.resolve('templates');
            await ui.setPopupContent(
              popup,
              templates['insert-link']({ attrs }),
            );

            popup.addEventListener('submit', (event: SubmitEvent) => {
              event.preventDefault();
              event.stopPropagation();

              const form = event.target as HTMLFormElement;
              const attrs = Object.fromEntries(new FormData(form).entries());

              editor.commandFactories.toggleMark(markType, attrs).apply({
                editor,
              }, [
                editor.view.state,
                editor.view.dispatch,
              ]);

              editor.view.focus();
              popup.remove();
            });
          })();
        }
        return true;
      };
    };

    const startSearch: CommandFactory = () => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        if (dispatch) {
          const ui: Ui = this.editor.ci.resolve('ui')!;

          (async () => {
            const popup = ui.createPopup({
              anchorId: 'center',
              layer: 'overlayer',
              group: 'dialog',
            });

            popup.addEventListener('remove', () => {
              editor.run.clearSearch();
            });

            const { from, to } = state.selection;
            const text = state.doc.textBetween(from, to, '\n');

            const templates: TemplatesRegistry = editor.ci.resolve('templates');
            await ui.setPopupContent(
              popup,
              templates['dialog-search']({ text }),
            );

            bindSearch(popup, editor);
            (popup.querySelector('[name=search]') as HTMLInputElement).focus();
          })();
        }
        return true;
      };
    };

    const startReplace: CommandFactory = () => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        if (dispatch) {
          const ui: Ui = this.editor.ci.resolve('ui')!;

          (async () => {
            const popup = ui.createPopup({
              anchorId: 'center',
              layer: 'overlayer',
              group: 'dialog',
            });

            popup.addEventListener('remove', () => {
              editor.run.clearSearch();
            });

            const { from, to } = state.selection;
            const text = state.doc.textBetween(from, to, '\n');

            const templates: TemplatesRegistry = editor.ci.resolve('templates');
            await ui.setPopupContent(
              popup,
              templates['dialog-replace']({ text, replace: '' }),
            );

            bindReplace(popup, editor);
            (popup.querySelector('[name=search]') as HTMLInputElement).focus();
          })();
        }
        return true;
      };
    };

    return {
      insertImage,
      toggleLink,
      createPopup,
      setPopupContent,
      clearPopups,
      startSearch,
      startReplace,
    };
  }

  override getKeyboardShortcuts(): Partial<CommandShortcuts> {
    return {
      'Ctrl-f': 'startSearch',
      'Ctrl-r': 'startReplace',
    };
  }

  override created(): void {
    const ui = new Ui(this.editor);
    this.editor.ci.register('ui', ui);
    const templates: TemplatesRegistry = {
      ...popupTemplateRegistry,
      ...roomTemplateRegistry,
    };
    this.editor.ci.register('templates', templates);
  }
}
