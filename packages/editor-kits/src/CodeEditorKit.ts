import { dracula } from 'thememirror';

import { AnyExtensionOrReq, Extension } from '@kerebron/editor';
import { ExtensionBasicCodeEditor } from '@kerebron/extension-basic-editor/ExtensionBasicCodeEditor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionDevToolkit } from '@kerebron/extension-dev-toolkit';
import { ExtensionMenuLegacy } from '@kerebron/extension-menu-legacy';
import {
  ExtensionCodeMirror,
  NodeDocumentCode,
} from '@kerebron/extension-codemirror';

export class CodeEditorKit extends Extension {
  override name = 'dev-advanced-editor';
  requires: AnyExtensionOrReq[];

  constructor(lang: string) {
    super();
    this.requires = [
      new ExtensionBasicCodeEditor({ lang }),
      new ExtensionMarkdown(),
      new ExtensionDevToolkit(),
      new ExtensionCodeMirror({
        languageWhitelist: [lang],
        readOnly: false,
      }),
    ];
  }
}
