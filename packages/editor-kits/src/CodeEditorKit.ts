import { dracula } from 'thememirror';

import { AnyExtensionOrReq, EditorKit, Extension } from '@kerebron/editor';
import { ExtensionBasicCodeEditor } from '@kerebron/extension-basic-editor/ExtensionBasicCodeEditor';
import { ExtensionDevToolkit } from '@kerebron/extension-dev-toolkit';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
// import { ExtensionCodeMirror } from '@kerebron/extension-codemirror';
import { ExtensionCodeJar } from '@kerebron/extension-codejar';

export class CodeEditorKit implements EditorKit {
  name = 'dev-advanced-editor';

  constructor(public readonly lang: string) {
  }

  getExtensions(): AnyExtensionOrReq[] {
    return [
      new ExtensionBasicCodeEditor({ lang: this.lang }),
      new ExtensionMarkdown(),
      new ExtensionDevToolkit(),
      // new ExtensionCodeMirror({
      //   languageWhitelist: [lang],
      //   readOnly: false,
      // }),
      new ExtensionCodeJar({ lang: this.lang }),
    ];
  }
}
