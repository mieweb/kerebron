import { dracula } from 'thememirror';

import { AnyExtensionOrReq, Extension } from '@kerebron/editor';
import { ExtensionBasicCodeEditor } from '@kerebron/extension-basic-editor/ExtensionBasicCodeEditor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionDevToolkit } from '@kerebron/extension-dev-toolkit';
// import { ExtensionCodeMirror } from '@kerebron/extension-codemirror';
import { ExtensionCodeJar } from '@kerebron/extension-codejar';

export class CodeEditorKit extends Extension {
  override name = 'dev-advanced-editor';
  requires: AnyExtensionOrReq[];

  constructor(lang: string) {
    super();
    this.requires = [
      new ExtensionBasicCodeEditor({ lang }),
      new ExtensionMarkdown(),
      new ExtensionDevToolkit(),
      // new ExtensionCodeMirror({
      //   languageWhitelist: [lang],
      //   readOnly: false,
      // }),
      new ExtensionCodeJar({ lang }),
    ];
  }
}
