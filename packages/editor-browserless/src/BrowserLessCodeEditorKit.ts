import { EditorKit } from '@kerebron/editor';
import { ExtensionBasicCodeEditor } from '@kerebron/extension-basic-editor/ExtensionBasicCodeEditor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';

import './window.ts';

interface BrowserLessCodeEditorKitConfig {
  lang: string;
}

export class BrowserLessCodeEditorKit implements EditorKit {
  name = 'browserless-code-editor-kit';

  constructor(private config: BrowserLessCodeEditorKitConfig) {
  }

  getExtensions() {
    return [
      new ExtensionBasicCodeEditor(this.config),
      new ExtensionMarkdown(),
    ];
  }
}
