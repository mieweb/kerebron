import { dracula } from 'thememirror';

import { AnyExtensionOrReq, Extension } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionOdt } from '@kerebron/extension-odt';
import { ExtensionTables } from '@kerebron/extension-tables';
import { ExtensionDevToolkit } from '@kerebron/extension-dev-toolkit';
import { ExtensionCustomMenu } from '@kerebron/extension-menu';
import { ExtensionCodeMirror } from '@kerebron/extension-codemirror';

export class AdvancedEditorKit extends Extension {
  override name = 'advanced-editor';
  requires: AnyExtensionOrReq[];

  constructor(menu?: ConstructorParameters<typeof ExtensionCustomMenu>[0]) {
    super();
    this.requires = [
      new ExtensionBasicEditor(),
      new ExtensionMarkdown(),
      new ExtensionOdt(),
      new ExtensionTables(),
      new ExtensionDevToolkit(),
      new ExtensionCustomMenu(menu),
      new ExtensionCodeMirror({
        theme: [dracula],
      }),
    ];
  }
}
