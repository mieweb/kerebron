import { EditorKit } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor/ExtensionBasicEditor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionTables } from '@kerebron/extension-tables';
import { ExtensionOdt } from '@kerebron/extension-odt';

import './window.ts';

export class BrowserLessEditorKit implements EditorKit {
  name = 'browserless-editor-kit';

  getExtensions() {
    return [
      new ExtensionBasicEditor(),
      new ExtensionMarkdown(),
      new ExtensionOdt(),
      new ExtensionTables(),
    ];
  }
}
