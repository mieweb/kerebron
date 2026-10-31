import type { AnyExtensionOrReq, EditorKit } from '@kerebron/editor';

import { ExtensionNotebook } from './ExtensionNotebook.ts';
import { NodeCodeCell } from './NodeCodeCell.ts';

export class NotebookEditorKit implements EditorKit {
  name = 'notebook-editor';

  static createFrom() {
    return new ExtensionNotebook();
  }

  constructor(public url: string) {
  }

  getExtensions(): AnyExtensionOrReq[] {
    return [
      new ExtensionNotebook(),
    ];
  }
}
