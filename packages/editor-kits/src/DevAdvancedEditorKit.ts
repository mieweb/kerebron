import { AnyExtensionOrReq, EditorKit } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor/ExtensionBasicEditor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionOdt } from '@kerebron/extension-odt';
import { ExtensionTables } from '@kerebron/extension-tables';
import { ExtensionDevToolkit } from '@kerebron/extension-dev-toolkit';
import { ExtensionMenuLegacy } from '@kerebron/extension-menu-legacy';
import { ExtensionCodeJar } from '@kerebron/extension-codejar';
import { ExtensionAutocomplete } from '@kerebron/extension-autocomplete';

export class DevAdvancedEditorKit implements EditorKit {
  name = 'dev-advanced-editor';

  constructor(
    public readonly menu?: ConstructorParameters<typeof ExtensionMenuLegacy>[0],
  ) {
  }

  getExtensions(): AnyExtensionOrReq[] {
    return [
      new ExtensionBasicEditor(),
      new ExtensionMarkdown(),
      new ExtensionOdt(),
      new ExtensionTables(),
      new ExtensionDevToolkit(),
      new ExtensionMenuLegacy(this.menu),

      new ExtensionCodeJar(),
      new ExtensionAutocomplete(),
    ];
  }
}
