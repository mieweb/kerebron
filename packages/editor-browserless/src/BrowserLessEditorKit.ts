import { AnyExtensionOrReq, Extension } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor/ExtensionBasicEditor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionTables } from '@kerebron/extension-tables';
import { ExtensionOdt } from '@kerebron/extension-odt';

import './window.ts';

export class BrowserLessEditorKit extends Extension {
  override name = 'browserless-editor-kit';
  requires: AnyExtensionOrReq[];

  constructor() {
    super();
    this.requires = [
      new ExtensionBasicEditor(),
      new ExtensionMarkdown(),
      new ExtensionOdt(),
      new ExtensionTables(),
    ];
  }
}
