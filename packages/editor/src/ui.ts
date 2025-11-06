import type { CoreEditor } from './CoreEditor.ts';

interface SelectParams {
  anchor: number;
  scrollIntoView: boolean;
  userEvent: string;
}

export interface EditorUi {
  showMessage(msg: string): void;
  showError(err: Error): void;
  focus(): void;
  select(params: SelectParams): void;
}

export function defaultUi(editor: CoreEditor): EditorUi {
  return {
    showMessage(msg: string) {
      globalThis.alert(msg);
    },
    showError(err: Error) {
      globalThis.alert(err.message);
      console.error(err);
    },
    focus() {
      // editor.run.focus();
    },
    select({
      anchor: number,
      scrollIntoView: boolean,
      userEvent: string,
    }) {
    },
  };
}
