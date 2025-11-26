import { dracula } from 'thememirror';

import { AnyExtensionOrReq, Extension } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionOdt } from '@kerebron/extension-odt';
import { ExtensionTables } from '@kerebron/extension-tables';
import { ExtensionDevToolkit } from '@kerebron/extension-dev-toolkit';
import { ExtensionMenuLegacy } from '@kerebron/extension-menu-legacy';
import { ExtensionCodeMirror } from '@kerebron/extension-codemirror';
import { ExtensionCodeJar } from '@kerebron/extension-codejar';

export class DevAdvancedEditorKit extends Extension {
  override name = 'dev-advanced-editor';
  requires: AnyExtensionOrReq[];

  constructor(menu?: ConstructorParameters<typeof ExtensionMenuLegacy>[0]) {
    super();
    this.requires = [
      new ExtensionBasicEditor(),
      new ExtensionMarkdown(),
      new ExtensionOdt(),
      new ExtensionTables(),
      new ExtensionDevToolkit(),
      new ExtensionMenuLegacy(menu),
      // new ExtensionCodeMirror({
      //   theme: [dracula],
      // }),
      new ExtensionCodeJar(),
    ];
  }
}
